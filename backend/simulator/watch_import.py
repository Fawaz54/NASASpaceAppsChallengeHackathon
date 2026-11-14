"""Owner: Backend A. Turns a smartwatch export into a personal baseline.

Put raw exports in the private/ folder (it is git-ignored; never commit them).

TODO:
- read the export (Apple Health export.xml, or the CSV/JSON other brands give)
- keep heart rate, resting heart rate, sleep duration and workout minutes
- return the average and normal range per metric, in the same shape as
  BASELINE in simulator.py, so the simulator can generate readings around it
"""


def load_baseline(export_path):
    raise NotImplementedError("Backend A: write the converter for your teammates' watch brand")
