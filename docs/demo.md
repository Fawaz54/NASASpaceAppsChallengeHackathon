# Demo script (about five minutes)

Use two browser tabs, or two laptops: one signed in as an astronaut ("the
ship") and one as a flight surgeon ("Earth"). Each tab keeps its own
sign-in. Give the astronaut's profile the location Mars base, so the delay
is 19 minutes each way, played as 19 seconds.

Use made-up accounts for the demo, and press "Reset demo" at the bottom of
the home screen before you start.

1. **Sign in.** Create an astronaut account (the profile is the pre-flight
   baseline) and a flight surgeon account. "The app knows what is normal for
   this person before launch."
2. **Normal day.** Home screen: the body figure and vitals tiles are green.
   Tap the heart to show the reading, what it means, and the 30-day chart
   with the crew average.
3. **Radiation for a long stay.** Point to the Mission card: today's dose
   and the mission total against NASA's 600 mSv career limit. It is always
   there, separate from the vitals.
4. **Daily check-in.** Do the five short assessments. Each greys out when
   done. After the last one the report `date_username_dailyreport` is sent.
   On the doctor's tab it arrives after the delay; write feedback, and the
   astronaut sees the report change from Delivered to Reviewed.
5. **Slow drift.** Press "Heart drift". Nothing is over a limit, but the
   heart turns amber because the last week has moved away from this
   person's baseline.
6. **Mood without pressure.** Press "Sleep and mood decline". Mood stays in
   a neutral colour; the app offers a private call instead of an alarm. The
   flight surgeon still sees the real status in the report.
7. **Automatic alert.** Press "Solar particle event". The dose rate climbs,
   the outline round the body turns red, a tone plays and the shelter
   checklist appears, with "Read steps aloud". Point out the real NASA DONKI
   event it names.
8. **Emergency.** Press "I need help". Crew and Earth are alerted at once.
   Type what happened, let the local AI fill in the questions, choose "Cut
   or scratch" to show the injury-specific questions, and get the steps.
9. **Mission control.** On the doctor's tab, show the corps overview (a
   simulated crew of 100) and, if Azure is set up, the reports saved there.
10. **Offline.** Turn off the wifi. The ship side keeps working, and
    reports wait to upload until the link returns.

Other scenario buttons: "Low blood oxygen", "Fever", "Missed exercise".
