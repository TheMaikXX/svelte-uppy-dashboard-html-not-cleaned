# Steps to reproduce
  1. `npm i`
  2. `npm run dev`
  3. Open url `http://localhost:5000` in Chrome (my version is 91.0.4472.124)
  4. Open DevTools
  5. Hit `Toggle form with upload` button. Form (with dummy input and button to open modal) opens
  6. Then hit the button again. Form disapears
  7. Repeat 4th and 5th step several times and watch HTML DOM change.
