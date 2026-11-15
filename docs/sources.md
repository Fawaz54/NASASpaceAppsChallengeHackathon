# Sources

Where every number, limit, checklist and explanation in the app comes from.

**How to read the "Checked" column**

- **Page**: the figure was read on the source page or document itself.
- **Summary**: the figure comes from search summaries or press coverage of the
  source. Open the link and confirm it before quoting it to judges.
- **Team**: chosen by the team. No published value exists or none was found.

Researched 14 November 2026.

## Datasets

| Dataset | Used for | Record | Checked |
|---|---|---|---|
| [NASA DONKI](https://ccmc.gsfc.nasa.gov/DONKI/api/) (CCMC, Goddard) | The radiation scenario names a real solar particle event. Its timing is real; dose values are simulated. | `2026-09-05T16:18:00-SEP-001`, measured by SOHO COSTEP. See `data/donki_event.json` | Page |
| Curiosity RAD (Mars Science Laboratory) | Background radiation on Mars and in transit | Via the published results below | Page |

## 3D body on the home screen

| Part | Source | Licence |
|---|---|---|
| Body surface | MakeHuman base mesh, turned into a point cloud by `tools/build_body.py` | CC0 (public domain) |
| Organs, bones and radiation halo | Generated from simple shapes by the same script | Made by the team |
| 3D drawing library | three.js, `frontend/js/vendor/three.module.min.js` | MIT (`three.LICENSE.txt`) |
| Figure code | `frontend/js/organs.js` and `frontend/js/cursor.js`, written by a teammate with AI assistance | Team |

The organs are placed for illustration and are not anatomically exact.

## Speech to text

whisper.cpp (MIT licence), running OpenAI's Whisper `base.en` model (MIT licence), entirely on the laptop.

## Simulated crew dataset

`data/crew_dataset.json` is a crew of 100 astronauts made by the team from
published ranges (heart rate, blood pressure, oxygen saturation, sleep,
radiation by mission phase and more). It is **simulated, not real astronaut
data**, and is labelled that way wherever the app shows it. It is used for
the mission control overview and for the "crew average" line on charts. It
is not evidence for any limit.

## Radiation

| What the app uses | Value | Source | Checked |
|---|---|---|---|
| NASA career radiation limit (context for the dose counter and pitch) | Less than 600 mSv, same for all ages and sexes | NASA-STD-3001 Volume 1, requirement [V1 4030], quoted in [NASA-STD-3001 Technical Brief OCHMO-TB-020](https://www.nasa.gov/wp-content/uploads/2023/03/radiation-protection-technical-brief-ochmo.pdf) | Page |
| NASA limit for one solar particle event | Less than 250 mSv effective dose per event | Same technical brief | Page |
| Two alert levels (watch, then act) for dose rate | NASA uses a first threshold for caution and closer monitoring, and a higher one to recommend shelter | [NASA: To Protect Artemis II Astronauts, NASA Experts Keep Eyes on Sun](https://science.nasa.gov/missions/artemis/artemis-2/to-protect-artemis-ii-astronauts-nasa-experts-keep-eyes-on-sun/) | Page |
| Dose-rate numbers for those two levels | 3.0 and 5.0 mSv/day | NASA does not publish its threshold values, so these are placeholders | Team |
| Checklist RAD-01 (build a shelter from stowage bags; within an hour; up to 24 hours) | Steps adapted from the Orion procedure | [NASA: Scientists and Engineers Evaluate Orion Radiation Protection Plan](https://www.nasa.gov/missions/artemis/orion/scientists-and-engineers-evaluate-orion-radiation-protection-plan/) | Page |

## Locations (`backend/store.py`)

| Location | Background dose rate | Signal delay | Source | Checked |
|---|---|---|---|---|
| Mars base | 0.67 mSv/day | 19 min used; real delay varies up to 22 min | Dose: Hassler et al., "Mars' Surface Radiation Environment Measured with the Mars Science Laboratory's Curiosity Rover", Science, 2014, quoted in the [SwRI release](https://swri.org/node/9079). Delay: ["Communication Delays, Disruptions, and Blackouts for Crewed Mars Missions"](https://ntrs.nasa.gov/citations/20220013418), NTRS 20220013418 | Page |
| In transit to Mars | 1.8 mSv/day | 10 min used; real delay varies from 0 to 22 min | Dose: Zeitlin et al., Science, 2013, quoted in the same SwRI release. Delay: same NTRS paper | Page |
| Lunar base | 1.4 mSv/day (measured 1,369 microsieverts/day) | 1.3 s | Dose: Zhang et al., "First measurements of the radiation dose on the lunar surface", Science Advances 6(39), 2020. Delay: Earth to Moon distance divided by the speed of light | Summary |
| Space station | 0.7 mSv/day (731 microsieverts/day in the same period) | None noticeable | Same Zhang et al. paper, which reports the station value for comparison | Summary |

## Health indicators and limits (`data/thresholds.json`, `data/indicators.json`)

| Indicator | What is sourced | Source | Checked | What is still a team choice |
|---|---|---|---|---|
| Blood pressure, high | 130 mmHg is stage 1 and 140 mmHg is stage 2 hypertension | [American Heart Association: Understanding Blood Pressure Readings](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings) (2017 ACC/AHA guideline) | Summary | Nothing: the app's 130 and 140 match |
| Blood pressure, low | Not sourced yet | | | 95 and 90 mmHg |
| Body temperature, high | Fever is 38.0 °C (100.4 °F) or higher; some authorities use 37.8 °C | [CDC: Definitions of Signs, Symptoms, and Conditions of Ill Travelers](https://www.cdc.gov/port-health/php/definitions-symptoms-reportable-illness/index.html) | Summary | Nothing: the app's 37.8 and 38.0 match |
| Body temperature, low | Not sourced yet | | | 36.0 and 35.0 °C |
| Blood sugar, low | Below 70 mg/dL is level 1 hypoglycemia, the level to treat; below 54 mg/dL is level 2 | American Diabetes Association, Standards of Care in Diabetes, section 6; [ADA patient sheet](https://professional.diabetes.org/sites/dpro/files/2025-05/hypoglycemia-patient-5-27-25.pdf) | Summary | The 80 mg/dL watch level |
| Blood sugar, high | Not sourced yet | | | 140 and 180 mg/dL |
| Blood sugar in space | Evidence is mixed: bed-rest and small spaceflight studies suggest reduced insulin sensitivity, but results conflict | No NASA report found; journal reviews only | Summary | |
| Blood oxygen | Not sourced yet | | | 95% and 92% |
| Water intake | Not sourced yet | | | 2.0 and 1.2 litres a day |
| Resting heart rate | Weightlessness shifts fluid toward the head and changes blood volume, flow and pressure, altering the heart and vessels | [NASA Human Research Roadmap: Risk of Cardiovascular Adaptations](https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=179) | Summary | 12% and 20% above personal baseline |
| Sleep | NASA schedules 8.5 hours; station crews averaged 6.09 hours | Barger et al., Lancet Neurology 13:904-912, 2014, doi 10.1016/S1474-4422(14)70122-X | Summary | 6.5 and 5.5 hour levels |
| Mood | Isolation and confinement can cause cognitive and behavioral changes, with higher risk on longer missions | [NASA Evidence Report: Risk of Adverse Cognitive or Behavioral Changes](https://humanresearchroadmap.nasa.gov/evidence/reports/HRP-ER-BMED-HFBP-20250210.pdf) (2025) | Summary | The 1 to 5 scale and its levels |
| Exercise | Station crews exercise an average of two hours a day | [NASA: Counteracting Bone and Muscle Loss in Microgravity](https://www.nasa.gov/missions/station/iss-research/counteracting-bone-and-muscle-loss-in-microgravity/) | Page | 80% and 60% of plan |
| Bone loss | About 1 to 1.5% of bone mineral lost per month, first seen on Skylab | [NASA: Fundamentals of Human Health](https://www.nasa.gov/reference/fundamentals-of-human-health/) | Page | |
| Immune changes | 53% of shuttle astronauts and 61% of station astronauts studied shed reactivated dormant viruses | Rooney et al., ["Herpes Virus Reactivation in Astronauts During Spaceflight and Its Application on Earth"](https://pmc.ncbi.nlm.nih.gov/articles/PMC6374706/), Frontiers in Microbiology, 2019 | Page | |
| The five hazards | Radiation, isolation and confinement, distance from Earth, gravity, hostile and closed environments | [NASA: 5 Hazards of Human Spaceflight](https://www.nasa.gov/hrp/hazards/) | Page | |

## Checklists (`data/protocols.json`)

| Protocol | Status |
|---|---|
| RAD-01 | Steps adapted from NASA's Orion shelter procedure (see Radiation above) |
| BON-01 | Team-written. Supported by NASA's two hours of daily exercise and the bone loss rate above |
| MND-01 | Team-written. Supported by the NASA behavioral evidence report and the sleep study above |
| HRT-01, HRT-02, LNG-01, GEN-05 | Team-written. Not medical advice |
| GEN-01 to GEN-04 | Team-written. The trigger levels are sourced above; the steps are not |
| EMG-* (emergency) | Team-written first-aid-level steps. Not medical advice. Leads for a real source: NASA's Shuttle Medical Checklist (JSC-48031) and the ISS Emergency Medical Procedures Manual |

## Still open

- A published source for the low blood pressure, low temperature, high blood sugar, blood oxygen and water intake levels.
- A real source for the emergency and general-health checklist steps.
- Confirming every row marked "Summary" by opening the link.
- NASA's own dose-rate alert thresholds are not public, so the app's values will stay team-chosen.

## Honest framing for the pitch

"The app's structure follows NASA: two-level radiation alerts, the Orion
shelter procedure, a personal baseline, and limits from NASA-STD-3001 and
standard clinical guidelines where they exist. Where no published limit
exists, such as a mood score, we chose a value and say so."
