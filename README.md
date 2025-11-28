# parishliturgyplanner
addin for google sheets

## Web interface

The project now includes a standalone web experience powered entirely by Apps Script HTML Service. Deploy it as a web app in the Apps Script editor (Deploy → New deployment → Web app) and set "Execute as" to "Me". The `doGet` handler renders `WebApp.html`, giving you:

- Full CRUD access to every sheet defined in `CONSTANTS.SHEETS`, using the live headers as form fields.
- Pagination-aware tables so you can browse and edit data from desktop, tablet, or phone.
- Dropdowns that honor the status enums and timeoff types from `0a_constants.gs`.
- An automations panel that mirrors the sidebar buttons (generate calendar/schedule, auto-assign, substitutes, printable schedule, timeoff review) with month selection when needed.
