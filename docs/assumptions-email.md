# Assumptions email (draft)

A draft for review before sending. Fill in the placeholders in square brackets; send the admin login in a separate message, never in this repository.

---

**Ämne:** Mini ATS: leverans, antaganden och inloggning

Hej [namn],

Här är min leverans av mini ATS:et.

* **Live:** https://ats.t4ngo.com
* **Repo:** https://github.com/GHT4ngo/ATS
* **Demo (5 min):** [länk till Loom]
* **Admininloggning:** skickas i ett separat mejl

Alla sju användarberättelser är på plats och testade, liksom bedömningen av CV:n med AI. Jag har också byggt en rekryteringsassistent och egna pipelinesteg per tjänst. README:n i repot visar skärmbilder, arkitektur och hur allt testas.

## Antaganden

**Kunder och konton**

* Kunden är ett företag (B2B). Varje kund är en organisation som kan ha flera användare, till exempel en rekryterare och en chef.
* Det finns ingen egen registrering. En admin hos oss skapar organisationen och användarna med ett tillfälligt lösenord som användaren byter själv. Glömt lösenord fungerar via mejl.
* En admin hjälper en kund genom att agera som kundens organisation, med en tydlig banderoll. Det är inte inloggning som kunden, så varje ändring loggas på admin.
* Inaktiverade användare kan inte logga in och kommer inte åt någon data, vilket också kontrolleras i databasen.

**Tjänster och kandidater**

* En kandidat tillhör en organisation och kan söka flera av dess tjänster. Varje ansökan har sitt eget steg i processen.
* Processen har sex fasta faser: ansökt, screening, intervju, erbjudande, anställd och avslagen. Varje tjänst kan få egna steg inom faserna, till exempel telefonintervju eller kodtest. Faserna ger en gemensam skala för översikten och rapporterna.
* CV:n laddas upp som PDF, högst 4 MB.

**AI**

* Bedömningen av CV:n med AI är ett beslutsstöd, inte ett beslut. Den körs bara när rekryteraren klickar, för att hålla nere kostnaden och ha en människa i loopen.
* Bedömningen bygger bara på jobbrelaterade belägg i CV:t. Prompten utesluter skyddade egenskaper och gissar aldrig kön utifrån ett namn.
* CV:n måste innehålla text. Inskannade CV:n (bara bilder) bedöms inte; appen säger det i stället för att gissa.
* Texten i CV:t skickas till Anthropic för bearbetning, vilket står i gränssnittet.
* Assistenten kan läsa och föreslå ändringar men ändrar aldrig något utan att användaren godkänner det. Mejl som den skriver är utkast och skickas inte.

**Drift och data**

* Datan ligger i Supabase i EU av hänsyn till GDPR. Varje tabell har radnivåsäkerhet, så en kund kan aldrig se en annan kunds data.
* Språket är svenska som standard, med engelska som alternativ. Användaren väljer språk och tema själv.
* Demodatan är ett påhittat bolag i Stockholm, Nordlys Tech AB, med fyra tjänster och 23 kandidater med CV:n.

## Hur jag angrep bedömningen med AI

Servern läser ut texten ur PDF:en och skickar den tillsammans med tjänstebeskrivningen till Claude med en fast poängskala och strukturerad utdata: poäng 0 till 100, sammanfattning, styrkor, luckor, matchning per krav med belägg och förslag på intervjufrågor. Varje körning sparas. För att kontrollera att poängen är stabila har jag ett eval som kör samma CV:n flera gånger: spridningen håller sig inom 6 poäng och rangordningen är densamma varje gång.

## Nästa steg

Med mer tid skulle jag börja med inbjudningar och notiser via mejl, en publik karriärsida där sökande hamnar direkt i Ansökt, import och export av kandidater som CSV, och en revisionslogg för admins.

Hör gärna av dig om du har frågor.

Vänliga hälsningar,
[ditt namn]
