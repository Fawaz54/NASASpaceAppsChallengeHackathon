"""Builds frontend/models/body.bin: the point cloud used by the 3D body on the home screen.

The body surface comes from the MakeHuman base mesh (CC0). The organs, bones and
the radiation halo are generated here from simple shapes, so there are no other
model files. Run it again only if you want to change the look of the points:

    curl -L -o base.obj https://raw.githubusercontent.com/makehumancommunity/makehuman/master/makehuman/data/3dobjs/base.obj
    python3 tools/build_body.py base.obj frontend/models/body.bin

Needs numpy. Units below are the mesh's own (1 unit is about 10.5 cm);
+x is the body's left, +y is up, +z is the front.
"""
import json
import struct
import sys

import numpy as np

rng = np.random.default_rng(7)


# ---------------------------------------------------------------- helpers

def load_body(path):
    verts, faces, group = [], [], None
    for line in open(path, encoding="utf-8", errors="replace"):
        part = line.split()
        if not part:
            continue
        if part[0] == "v":
            verts.append([float(v) for v in part[1:4]])
        elif part[0] == "g":
            group = part[1] if len(part) > 1 else None
        elif part[0] == "f" and group == "body":
            ids = [int(token.split("/")[0]) - 1 for token in part[1:]]
            for k in range(1, len(ids) - 1):
                faces.append([ids[0], ids[k], ids[k + 1]])
    return np.array(verts), np.array(faces)


def thin(points, radius, *extra):
    """Keeps points that are at least `radius` apart, so the cloud looks even."""
    cell = radius
    keys = np.floor(points / cell).astype(np.int64)
    grid, keep = {}, []
    r2 = radius * radius
    for i in range(len(points)):
        kx, ky, kz = keys[i]
        p = points[i]
        ok = True
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for dz in (-1, 0, 1):
                    for j in grid.get((kx + dx, ky + dy, kz + dz), ()):
                        d = points[j] - p
                        if d[0] * d[0] + d[1] * d[1] + d[2] * d[2] < r2:
                            ok = False
                            break
                    if not ok:
                        break
                if not ok:
                    break
            if not ok:
                break
        if ok:
            grid.setdefault((kx, ky, kz), []).append(i)
            keep.append(i)
    keep = np.array(keep)
    return (points[keep], *[e[keep] for e in extra])


def sample_surface(verts, faces, count):
    a, b, c = verts[faces[:, 0]], verts[faces[:, 1]], verts[faces[:, 2]]
    face_normal = np.cross(b - a, c - a)
    area = np.linalg.norm(face_normal, axis=1) / 2
    vertex_normal = np.zeros_like(verts)
    for k in range(3):
        np.add.at(vertex_normal, faces[:, k], face_normal)
    vertex_normal /= np.linalg.norm(vertex_normal, axis=1, keepdims=True) + 1e-9
    pick = rng.choice(len(faces), size=count, p=area / area.sum())
    u, v = rng.random(count), rng.random(count)
    flip = u + v > 1
    u[flip], v[flip] = 1 - u[flip], 1 - v[flip]
    w = 1 - u - v
    points = a[pick] * w[:, None] + b[pick] * u[:, None] + c[pick] * v[:, None]
    normals = (vertex_normal[faces[pick, 0]] * w[:, None] + vertex_normal[faces[pick, 1]] * u[:, None]
               + vertex_normal[faces[pick, 2]] * v[:, None])
    normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-9
    return points, normals


def solid(inside, low, high, tries, spacing, core=0.16):
    """Fills a shape with points. `inside(p)` returns a value that is below 1 inside
    the shape and close to 1 at its surface; the surface is kept denser than the core."""
    p = rng.uniform(low, high, size=(tries, 3))
    value = inside(p)
    keep = (value < 1) & ((value > 0.84) | (rng.random(tries) < core))
    return thin(p[keep], spacing)[0]


def spline(knots, steps=400):
    """Smooth curve through the given points (Catmull-Rom)."""
    k = np.array(knots, dtype=float)
    k = np.vstack([k[0] * 2 - k[1], k, k[-1] * 2 - k[-2]])
    out = []
    for i in range(1, len(k) - 2):
        t = np.linspace(0, 1, steps // (len(k) - 3), endpoint=False)[:, None]
        p0, p1, p2, p3 = k[i - 1], k[i], k[i + 1], k[i + 2]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(k[-2][None])
    return np.vstack(out)


def tube(knots, radius, count, spacing, fill=0.0, gaps=0):
    """Points on a tube that follows a curve. `radius` may be a number or a function of
    the position along the tube (0 to 1). `gaps` cuts it into that many short segments."""
    path = spline(knots)
    seg = np.diff(path, axis=0)
    length = np.concatenate([[0], np.cumsum(np.linalg.norm(seg, axis=1))])
    t = rng.random(count)
    if gaps:
        t = t[(t * gaps) % 1 < 0.7]
    s = t * length[-1]
    i = np.clip(np.searchsorted(length, s) - 1, 0, len(seg) - 1)
    f = (s - length[i]) / (length[i + 1] - length[i] + 1e-9)
    centre = path[i] + seg[i] * f[:, None]
    tangent = seg[i] / (np.linalg.norm(seg[i], axis=1, keepdims=True) + 1e-9)
    ref = np.where(np.abs(tangent[:, 1:2]) < 0.9, [[0, 1, 0]], [[1, 0, 0]])
    side = np.cross(tangent, ref)
    side /= np.linalg.norm(side, axis=1, keepdims=True)
    up = np.cross(tangent, side)
    angle = rng.random(len(t)) * 2 * np.pi
    r = radius(t) if callable(radius) else np.full(len(t), radius)
    shell = np.where(rng.random(len(t)) < fill, np.sqrt(rng.random(len(t))), 1.0)
    points = centre + (side * np.cos(angle)[:, None] + up * np.sin(angle)[:, None]) * (r * shell)[:, None]
    return thin(points, spacing)[0]


def ellipsoid(p, centre, semi):
    return np.linalg.norm((p - centre) / semi, axis=1)


# ---------------------------------------------------------------- organs

def brain():
    centre, semi = np.array([0, 7.78, 0.45]), np.array([0.62, 0.52, 0.76])

    def cerebrum(p):
        q = (p - centre) / semi
        folds = 0.05 * np.sin(13 * q[:, 0] + 2.6 * np.sin(9 * q[:, 2])) * np.sin(11 * q[:, 1] + 2.2 * np.sin(8 * q[:, 0]))
        value = np.linalg.norm(q, axis=1) + folds
        value[(np.abs(q[:, 0]) < 0.05) & (q[:, 1] > -0.25)] = 2      # gap between the two halves
        value[q[:, 1] < -0.72] = 2                                   # flat underside
        grooves = np.sin(15 * q[:, 2] + 3 * np.sin(10 * q[:, 1] + 4 * q[:, 0])) > 0.72
        value[grooves & (value > 0.84)] = 2
        return value

    parts = [
        solid(cerebrum, centre - semi, centre + semi, 260000, 0.046, core=0.05),
        solid(lambda p: ellipsoid(p, np.array([0, 7.36, -0.02]), np.array([0.44, 0.22, 0.3])),
              [-0.5, 7.1, -0.4], [0.5, 7.62, 0.32], 30000, 0.046, core=0.05),
        tube([[0, 7.42, 0.2], [0, 7.1, 0.17], [0, 6.8, 0.12]], 0.1, 600, 0.046),
    ]
    return np.vstack(parts)


HEART_CENTRE = np.array([0.2, 3.92, 0.74])
HEART_AXIS = np.array([0.45, -0.8, 0.36]) / np.linalg.norm([0.45, -0.8, 0.36])


def heart_value(p, grow=1.0):
    d = p - HEART_CENTRE
    along = d @ HEART_AXIS
    across = np.linalg.norm(d - along[:, None] * HEART_AXIS, axis=1)
    t = along / (0.62 * grow)                       # -1 at the top, 1 at the tip
    profile = np.sqrt(np.clip(1 - ((t + 0.12) / 1.12) ** 2, 0, None)) * (1 - 0.38 * np.clip(t, 0, None))
    value = across / (0.47 * grow * profile + 1e-6)
    value[(t < -1.24) | (t > 1)] = 2
    return value


def heart():
    parts = [
        solid(heart_value, HEART_CENTRE - 0.8, HEART_CENTRE + 0.8, 90000, 0.04, core=0.1),
        # aorta: up, over in an arch, then down along the spine
        tube([[0.1, 4.3, 0.7], [0.06, 4.75, 0.62], [0.12, 5.02, 0.42], [0.24, 4.98, 0.16], [0.24, 4.6, 0.04],
              [0.18, 3.9, 0.02], [0.12, 3.1, 0.06]], lambda t: 0.115 - 0.035 * t, 2600, 0.04),
        tube([[0.26, 4.3, 0.86], [0.42, 4.5, 0.74], [0.56, 4.66, 0.56]], 0.095, 700, 0.04),   # to the lungs
        tube([[-0.2, 4.28, 0.62], [-0.23, 4.7, 0.58], [-0.22, 5.08, 0.55]], 0.085, 700, 0.04),  # large vein
    ]
    return np.vstack(parts)


def lungs():
    parts = []
    for side in (-1, 1):
        centre, semi = np.array([side * 0.67, 4.12, 0.45]), np.array([0.47, 1.15, 0.62])

        def lobe(p, side=side, centre=centre, semi=semi):
            q = (p - centre) / semi
            widen = 0.66 + 0.34 * np.clip((1 - q[:, 1]) / 2, 0, 1)            # narrow at the top
            height = np.where(q[:, 1] < 0, np.abs(q[:, 1]) ** 3.2, q[:, 1] ** 2)   # blunt at the bottom
            value = np.sqrt((q[:, 0] / widen) ** 2 + (q[:, 2] / widen) ** 2 + height)
            dome = np.linalg.norm((p - [side * 0.5, 2.3, 0.5]) / [1.0, 0.98, 1.0], axis=1)  # hollow base
            value[dome < 1] = 2
            value[heart_value(p, 1.3) < 1] = 2                                # room for the heart
            value[p[:, 0] * side < 0.17] = 2
            return value

        parts.append(solid(lobe, centre - semi, centre + semi, 150000, 0.05, core=0.07))
        parts.append(tube([[0, 4.82, 0.36], [side * 0.22, 4.62, 0.38], [side * 0.46, 4.42, 0.42]], 0.075, 500, 0.045))
    parts.append(tube([[0, 5.85, 0.42], [0, 5.3, 0.36], [0, 4.82, 0.36]], 0.105, 2200, 0.045, gaps=11))  # windpipe
    return np.vstack(parts)


def abdomen():
    def liver(p):
        q = (p - [-0.36, 2.62, 0.68]) / [0.8, 0.43, 0.52]
        thin_left = 0.5 + 0.5 * np.clip((0.55 - q[:, 0]) / 1.3, 0, 1)   # tapers toward the body's left
        value = np.sqrt(q[:, 0] ** 2 + (q[:, 1] / thin_left) ** 2 + (q[:, 2] / thin_left) ** 2)
        value[q[:, 1] < -0.95 + 0.55 * (q[:, 0] + 1) / 2] = 2            # slanted lower edge
        return value

    parts = [
        solid(liver, [-1.2, 2.15, 0.1], [0.5, 3.08, 1.25], 110000, 0.047, core=0.06),
        # stomach: a J-shaped pouch
        tube([[0.24, 3.08, 0.46], [0.5, 2.98, 0.52], [0.74, 2.74, 0.62], [0.76, 2.4, 0.74], [0.56, 2.1, 0.84],
              [0.22, 2.02, 0.86], [-0.02, 2.12, 0.8]],
             lambda t: 0.09 + 0.25 * np.sin(np.clip((t - 0.08) / 0.92, 0, 1) * np.pi) ** 0.7, 5200, 0.047),
    ]
    for side in (-1, 1):   # kidneys: bean shapes at the back
        centre = np.array([side * 0.62, 1.96, 0.03])

        def kidney(p, side=side, centre=centre):
            value = ellipsoid(p, centre, np.array([0.2, 0.36, 0.17]))
            value[np.linalg.norm(p - (centre - [side * 0.27, 0, 0]), axis=1) < 0.17] = 2
            return value

        parts.append(solid(kidney, centre - 0.4, centre + 0.4, 30000, 0.045, core=0.08))
    # large intestine: up the right side, across, down the left, with a beaded outline
    parts.append(tube([[-0.82, 0.72, 0.72], [-0.9, 1.25, 0.76], [-0.88, 1.74, 0.72], [-0.5, 1.72, 0.92],
                       [0, 1.56, 1.02], [0.5, 1.72, 0.92], [0.9, 1.82, 0.68], [0.94, 1.3, 0.72],
                       [0.9, 0.86, 0.72], [0.56, 0.56, 0.62], [0.16, 0.44, 0.4]],
                      lambda t: 0.135 + 0.028 * np.sin(t * 95), 9000, 0.047))
    # small intestine: a folded tube in the middle
    rows = []
    for k, y in enumerate(np.linspace(1.4, 0.74, 5)):
        xs = np.linspace(-0.56, 0.56, 4) * (1 if k % 2 == 0 else -1)
        rows += [[x, y + 0.05 * np.sin(j * 2.1), 0.78 + 0.12 * np.cos(j * 1.7 + k)] for j, x in enumerate(xs)]
    parts.append(tube(rows, 0.083, 9000, 0.047))
    return np.vstack(parts)


def bones():
    def knobbly(base):   # thicker at both ends, like a long bone
        return lambda t: base * (1 + 0.85 * np.exp(-(t / 0.07) ** 2) + 0.85 * np.exp(-((1 - t) / 0.07) ** 2))

    spine = [[0, 6.95, 0.16], [0, 6.3, 0.2], [0, 5.7, 0.0], [0, 5.0, -0.2], [0, 4.2, -0.15], [0, 3.4, 0.0],
             [0, 2.6, 0.07], [0, 1.8, -0.06], [0, 1.2, -0.28]]
    parts = [
        tube(spine, lambda t: 0.1 + 0.07 * t, 9000, 0.042, gaps=24, fill=0.35),
        tube([[0, 1.2, -0.28], [0, 0.8, -0.42], [0, 0.42, -0.36]], lambda t: 0.2 - 0.13 * t, 900, 0.042),   # sacrum
    ]
    # pelvis: a tilted ring (lower at the front) with a curved hip plate on each side
    loop = [[0.86 * np.cos(a), 0.62 - 0.26 * np.sin(a), 0.12 + 0.6 * np.sin(a)] for a in np.linspace(0, 2 * np.pi, 13)]
    parts.append(tube(loop, 0.07, 2600, 0.045))
    for side in (-1, 1):
        direction = rng.normal(size=(9000, 3))
        direction /= np.linalg.norm(direction, axis=1, keepdims=True)
        keep = (direction[:, 0] * side > 0.2) & (direction[:, 1] > -0.3) & (direction[:, 2] < 0.7)
        plate = np.array([side * 0.74, 0.9, 0.04]) + direction[keep] * [0.64, 0.7, 0.6]
        parts.append(thin(plate, 0.05)[0])
    for side in (-1, 1):
        s = np.array([side, 1, 1])
        parts += [
            tube([s * [1.1, 0.49, 0.12], s * [1.42, 0.3, 0.1], s * [1.5, -0.6, 0.14], s * [1.58, -3.6, 0.32]], knobbly(0.115), 3000, 0.045),
            tube([s * [1.58, -3.82, 0.3], s * [2.1, -7.4, 0.02]], knobbly(0.095), 2400, 0.045),
            tube([s * [1.78, -3.9, 0.22], s * [2.32, -7.42, -0.06]], 0.045, 900, 0.045),
            tube([s * [1.68, 5.25, 0.15], s * [3.1, 3.52, 0.13]], knobbly(0.085), 1700, 0.045),
            tube([s * [3.16, 3.42, 0.2], s * [4.22, 2.52, 1.66]], 0.052, 800, 0.045),
            tube([s * [3.1, 3.36, 0.06], s * [4.34, 2.42, 1.74]], 0.048, 800, 0.045),
            tube([s * [0.2, 5.26, 0.74], s * [0.9, 5.42, 0.62], s * [1.6, 5.42, 0.28]], 0.06, 700, 0.045),
        ]
    return np.vstack(parts)


# ---------------------------------------------------------------- build

def main(source, target):
    verts, faces = load_body(source)
    surface, normals = sample_surface(verts, faces, 420000)
    # The mesh also models the inside of the mouth and the eye sockets. Seen through
    # a see-through skin they look like dark rings, so leave them out.
    x, y, z = np.abs(surface[:, 0]), surface[:, 1], surface[:, 2]
    hidden = ((x < 0.42) & (y > 6.3) & (y < 6.9) & (z > 0.3) & (z < 1.47)) | ((x > 0.1) & (x < 0.52) & (y > 7.12) & (y < 7.46) & (z > 0.8) & (z < 1.36))
    surface, normals = surface[~hidden], normals[~hidden]
    body, body_normals = thin(surface, 0.072, normals)
    halo_points, halo_normals = thin(surface[:60000], 0.24, normals[:60000])
    reach = 0.5 + 0.75 * rng.random(len(halo_points)) ** 1.6
    halo = halo_points + halo_normals * reach[:, None]

    groups = [("body", body), ("radiation", halo), ("mind", brain()), ("lungs", lungs()),
              ("heart", heart()), ("general", abdomen()), ("bone", bones())]

    # Recentre and scale so the figure is 2 units tall and turns about its own middle.
    low, high = verts[np.unique(faces)].min(axis=0), verts[np.unique(faces)].max(axis=0)
    origin = np.array([0, (low[1] + high[1]) / 2, 0.3])
    scale = 2 / (high[1] - low[1])
    place = lambda p: (np.asarray(p, dtype=float) - origin) * scale

    extent = 1.25
    header = {"extent": extent, "groups": [], "anchors": {}, "pain": {}}
    positions, normal_bytes = [], []
    start = 0
    for name, points in groups:
        points = place(points)
        assert np.abs(points).max() < extent, name
        header["groups"].append({"area": name, "start": start, "count": len(points),
                                 "centre": [round(float(v), 4) for v in (points.min(axis=0) + points.max(axis=0)) / 2]})
        positions.append(np.round(points / extent * 32767).astype("<i2"))
        n = body_normals if name == "body" else np.zeros_like(points)
        normal_bytes.append(np.round(n * 127).astype("i1"))
        start += len(points)
        print(f"{name:10s} {len(points):6d} points")

    # Where each label's line points, and where reported pain is marked.
    anchors = {"mind": [0, 7.8, 0.5], "lungs": [-0.7, 4.5, 0.5], "heart": [0.22, 3.9, 0.8], "general": [0.3, 1.9, 0.9],
               "bone": [1.5, -1.6, 0.2], "radiation": [0, 9.1, 0.3]}
    pain = {"Head": [0, 7.9, 1.45], "Neck": [0, 5.95, 0.78], "Chest": [0, 4.4, 1.42], "Abdomen": [0, 2.0, 1.46],
            "Upper back": [0, 4.6, -0.52], "Lower back": [0, 2.0, -0.36], "Left arm": [2.5, 4.2, 0.42],
            "Right arm": [-2.5, 4.2, 0.42], "Left leg": [1.5, -2.2, 0.72], "Right leg": [-1.5, -2.2, 0.72]}
    header["anchors"] = {k: [round(float(c), 4) for c in place(v)] for k, v in anchors.items()}
    header["pain"] = {k: [round(float(c), 4) for c in place(v)] for k, v in pain.items()}
    header["count"] = start

    text = json.dumps(header).encode()
    text += b" " * (-len(text) % 4)
    seeds = rng.integers(0, 256, size=start, dtype=np.uint8)
    with open(target, "wb") as out:
        out.write(b"CHB1" + struct.pack("<I", len(text)) + text)
        out.write(np.vstack(positions).tobytes())
        out.write(np.vstack(normal_bytes).tobytes())
        out.write(seeds.tobytes())
    print(f"{start} points written to {target}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
