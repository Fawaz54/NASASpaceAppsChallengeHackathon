# Azure medical archive

The ship side of the app never uses the internet. The Earth side keeps every
message that reaches mission control (daily reports, alerts, emergencies and
the flight surgeon's replies) in Microsoft Azure Blob Storage, one JSON file
per message. If the internet is down, messages wait and upload when it returns.

Only the laptop playing "Earth" needs this set up. Without it, the app runs
exactly as before and the doctor screen shows the archive as "Not set up".

## One-time setup (about 10 minutes)

Menu names in the Azure portal change from time to time; look for the
closest match if one differs.

1. **Get an account.** Sign up at https://azure.microsoft.com/free/students
   with a school email (free credit, no credit card), or use any Azure account.
2. **Create a storage account.** In https://portal.azure.com search for
   "Storage accounts" and choose Create. Pick any resource group and a
   lowercase name such as `snowgeekscrewhealth`. Leave the other options at
   their defaults, then Review and Create.
3. **Create a container.** Open the storage account, choose Containers in the
   left menu, then "+ Container". Name it `crew-reports` and keep access
   private.
4. **Generate the access link.** Open the container and choose "Shared access
   tokens" in the left menu.
   - Permissions: tick Read, Add, Create, Write and List.
   - Expiry: a date after the hackathon ends.
   - Press "Generate SAS token and URL" and copy the **Blob SAS URL**.
5. **Give it to the app.** Open `private/azure.json` in this project and
   paste the URL between the quotes:

   ```json
   {"container_sas_url": "PASTE THE BLOB SAS URL HERE"}
   ```

6. Restart the app (`python3 backend/main.py`) and open
   http://localhost:8000/doctor.html. The "Medical archive" card should say
   "Connected".

Treat the SAS URL like a password. Anyone who has it can read and write the
container until it expires. It stays in `private/`, which Git ignores; never
paste it into chat, a commit or a screenshot.

## What gets stored

Each file is named `crew/date_crew_kind_number.json`, for example
`fawaz/2026-11-14_fawaz_daily_report_0007.json`, and holds:

- the message itself (title, body, who sent it, when)
- whether a daily report was all in range
- the conditions locked in when it was sent: crew member, mission day,
  location, signal delay, background radiation rate and gravity

Use a made-up profile for demos. Reports carry the crew member's name and
readings, so do not upload ones based on a real person's health data.

## Showing it in the demo

1. Send a daily check-in from the crew screen.
2. On the doctor screen, the report arrives after the signal delay and gets a
   "Saved to Azure" tag. The archive card lists the new file.
3. Open the container in the Azure portal and show the same file there.
4. Turn the wifi off and send another report. The ship side keeps working;
   the doctor screen shows "No connection: messages are waiting".
5. Turn the wifi back on. Within a few seconds the waiting messages upload.

## How it works

`backend/cloud.py` runs a small background loop on the Earth side. Every two
seconds it uploads any message that has reached Earth and is not stored yet,
using Azure's plain web interface, so there is no Azure library to install.
