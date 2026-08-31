TEXTMIKROSKOP – SCHULVERSION

FUNKTIONEN
- mobilfreundliche Web-App
- Zugangscode
- API-Schlüssel nur auf dem Server
- Tageslimit pro IP-Adresse
- Schüleransicht ohne Erwartungshorizonte
- Lehreransicht mit Erwartungshorizonten
- 2 Fragen je AFB I, II und III
- stark vereinfachte Erklärung + Alltagsbeispiel + Merksatz

LOKAL TESTEN
1. Node.js installieren.
2. In diesem Ordner: npm install
3. .env.example nach .env kopieren.
4. OPENAI_API_KEY, ACCESS_PASSWORD und SESSION_SECRET eintragen.
5. npm start
6. http://localhost:3000 öffnen.

ONLINE BEREITSTELLEN
Die App benötigt einen Node.js-Webdienst (z.B. Render oder Railway).
Als Startkommando wird "npm start" verwendet.
Die Werte aus .env werden beim Hosting als geheime Environment Variables eingetragen.
Die Datei .env niemals hochladen oder veröffentlichen.

WICHTIG ZUM LIMIT
Das eingebaute Tageslimit ist absichtlich einfach und wird im Arbeitsspeicher gehalten.
Bei einem Server-Neustart beginnt es neu. Für einen größeren öffentlichen Einsatz sollte
das Limit später in Redis oder einer Datenbank gespeichert und der Zugang pro Nutzer
geregelt werden.

DATENSCHUTZ
In die App sollten keine personenbezogenen Schülerdaten eingegeben werden.
Für einen schulweiten Einsatz sollten zusätzlich die schulischen Datenschutzvorgaben
und ggf. ein Auftragsverarbeitungs-/Freigabeprozess geprüft werden.
