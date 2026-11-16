# VOICE-08 · Poslech na fyzickém Androidu

1. Spusť statickou kopii větve `feat/voice-08-android-commentary` a otevři ji v Chrome na Androidu. Pro lokální test stačí ze složky repozitáře `python3 -m http.server 8765 --bind 0.0.0.0` a telefon na stejné Wi-Fi. Otevři Detail zápasu → Komentář.
2. V nastavení Androidu stáhni místní česká hlasová data. V komentáři rozbal ⚙, vyber český hlas, stiskni **Poslechnout ukázku** a potvrď ho, pokud zní žensky. Zaznamenej model telefonu, verzi Androidu a Chrome, název TTS enginu a název hlasu. Web Speech API neposkytuje spolehlivý údaj o pohlaví hlasu.
3. Spusť **Od začátku** u dohraného utkání s gólem a asistencemi. Poslechni klidnou pasáž, šanci zblízka, gól i následnou větu. Změř přibližný čas od klepnutí na **Spustit** do první slabiky a posuď přirozenost výkřiku, pauzy a výslovnost jmen. Vyzkoušej sportovní přednes zapnutý i vypnutý a přepis výslovnosti.
4. U živého utkání spusť **Živě** uprostřed třetiny. Porovnej úvodní skóre, čas a střely s detailem. Při sledu nových událostí ověř, že gól dostane přednost před běžnou střelou a že ruční obnovení nepřečte stejnou událost znovu.
5. Poslechni dohraný zápas s nájezdy a jeden s gólem v prodloužení. Zkontroluj, že nájezdy mají vlastní hlášky a nezvyšují počet střel na branku. U přesilovky s ověřitelnou změnou počtu bruslařů porovnej ohlášený začátek a návrat v pěti s událostmi NHL.
6. Vyzkoušej **Pauza**, **Pokračovat**, **Zastavit**, změnu režimu a zavření detailu uprostřed hlášky. Po pauze může znovu začít rozečtená fráze. Po zavření detailu musí hlas utichnout. Pro kontrolu místního hlasu jde po načtení událostí vypnout připojení a spustit **Od začátku**.

Přehrávání v automatickém Chromium testu používá řízenou náhradu Web Speech API. Kvalitu hlasu, reakci Android TTS a výslovnost ověří poslech na telefonu. Původní experimenty se Spotem popisují historické dokumenty VOICE-04 a VOICE-07.
