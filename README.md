# BANGER NHL LIVE

Webová aplikace pro sledování NHL: zápasy, statistiky, detail utkání, reporty a český komentář.

**Živá aplikace:** https://petrmalatnhl19.github.io/banger-nhl-live/

## Audit – plán úprav mimo predikční CORE

Predikční modely CORE 3.x–4.3 jsou mimo rozsah následujících úprav. Neměnit jejich váhy, výpočty ani historické predikce.

### 1. Spolehlivost a testy (nejvyšší priorita)
- [ ] Opravit zastaralé automatické testy, které předpokládají jediný inline skript v `index.html`.
- [ ] Ověřit úspěšný build a nasazení GitHub Pages.
- [ ] Zkontrolovat stav načítání při přechodu z detailu zápasu zpět na úvodní stránku.
- [ ] Ošetřit chyby API a závody starších/novějších odpovědí při rychlém přepínání.
- [ ] Otestovat mobilní navigaci, detail zápasu a prázdné/chybové stavy.

### 2. Uživatelské rozhraní
- [ ] Zjednodušit hierarchii hlavních záložek a jasně oddělit Statistiky od Analytiky.
- [ ] Odstranit duplicitní informace a panely v detailu zápasu.
- [ ] Zpřehlednit podrobný report a vysvětlivky metrik.
- [ ] Zachovat kompaktní, čitelné mobilní karty a stávající vizuální styl.

### 3. Technický úklid
- [ ] Rozdělit velký `index.html` do modulů po malých bezpečných změnách.
- [ ] Postupně sjednotit CSS a omezit překrývající se `!important`.
- [ ] Prověřit opakované požadavky a bezpečné vykreslování dynamického HTML.
- [ ] Po každé změně provést regresní kontrolu.

## Pravidla bezpečného vývoje

1. Před změnou ověřit aktuální stav v repozitáři.
2. Každou úpravu držet co nejmenší a nesouvisející části neměnit.
3. Odlišovat **uloženo do GitHubu**, **nasazeno** a **ověřeno v prohlížeči**.
4. Neoznačovat úkol za dokončený bez odpovídajícího testu.
5. Zachovat aktuální chování CORE a jejich archivovaných predikcí.
