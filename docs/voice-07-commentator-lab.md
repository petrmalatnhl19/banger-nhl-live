# VOICE-07 · Český hokejový komentátor

## Co se dá poslechnout

Na samostatné stránce `voice-07-test.html` je pět situací: běžný komentář, nebezpečná akce, velká šance, gól a rozbor. Každá má neutrální a sportovní variantu se stejnými slovy, interpunkcí, hlasem a dělením na fráze. Sportovní varianta mění tempo přímo při syntéze každé fráze, zesílí například výkřik „Gól!“ a přidá pauzu před vyústěním akce. WAV se přehrává rychlostí 1×. Výsledná intonace vychází z M2 a interpunkce. Pauza a hlasitost jsou řízené, výšku hlasu či radost model explicitně neřídí. Střih po frázích může oslabit návaznost intonace.

Stránka zkouší pevné ukázkové situace. Pro pozdější živé napojení lze gól vybírat z potvrzené události play-by-play, velkou šanci a nebezpečnou akci z ověřeného signálu o kvalitě situace a rozbor z události konce třetiny. Běžná střela sama kvalitu šance neprokazuje. Po potvrzení hlasu změřit čas od přijetí události po první zvuk a zahazovat zastaralé repliky.

## Technologie

| Možnost | Čeština a sportovní přednes | Android a doba odezvy | Náklady a podmínky |
| --- | --- | --- | --- |
| Supertonic 3 M2 FP16 / FP32 | Mužská čeština ověřená uživatelem u FP16. Lokální rozhraní přijímá text, jazyk, vektor stylu, počet kroků a tempo. M2 je jeden preset bez dokumentovaného ovladače emocí nebo SSML v používaném ONNX rozhraní. | Běží v Android Chrome ve workeru přes WASM. Ukázka VOICE-06 potřebovala 183,3 s na načtení a 25,0 s na syntézu. | Bez poplatku za jednotlivá volání při lokálním běhu. Kód příkladu MIT, váhy OpenRAIL-M s omezeními použití. Před veřejným použitím FP16 ověřit i původ a podmínky konkrétního převodu. |
| ElevenLabs Eleven v4 / v4 Turbo | Podporují češtinu a pokyny k přednesu jako `[excited]`. Vybrat mužský hlas s českou výslovností a stejný hlas otestovat ve všech situacích. | Cloudový stream přes backend. U Turbo dodavatel uvádí medián přibližně 100 ms na straně serveru pro zahřátý hlas. Skutečný čas do prvního zvuku na telefonu zahrnuje síť a aplikaci. | Komerční oprávnění podle plánu a zvoleného hlasu. Ceník uvádí Starter od 6 USD za měsíc s 30 000 kredity. Spotřebu ověřit pro konkrétní model a plán. |
| OpenAI `gpt-realtime-2.1-mini` | Ověřit českého mužského kandidáta a výslovnost jmen v poslechovém testu. Požadovaný přednes lze popsat instrukcí v relaci. | Zvuk streamovat z Realtime API. Skutečnou latenci češtiny změřit. Starší `gpt-4o-mini-tts` má oznámený konec 6. ledna 2027. | Tarif API podle tokenů, v době auditu 20 USD za milion výstupních audio tokenů. Platí podmínky hostované služby. |
| Azure Speech Antonín | Český mužský hlas `cs-CZ-AntoninNeural`. SSML umožňuje řešit pauzy a prosodii. V katalogu pro Antonína nejsou uvedeny emocionální styly. | Streamovaná cloudová syntéza přes backend, latence na telefonu nezměřená. | Účtuje se podle znaků a zvoleného regionu. Platí podmínky služby Azure. |

- [Supertonic 3 a licence vah](https://huggingface.co/Supertone/supertonic-3/tree/3cadd1ee6394adea1bd021217a0e650ede09a323) · [rozhraní Supertonic](https://github.com/supertone-oss-archive/supertonic-py/blob/main/supertonic/core.py)
- [Modely ElevenLabs](https://elevenlabs.io/docs/overview/models/) · [řízení přednesu](https://elevenlabs.io/blog/elevenlabs-audio-tags-list) · [metodika latence](https://elevenlabs.io/docs/eleven-api/concepts/latency-methodology) · [ceník](https://elevenlabs.io/pricing)
- [Přechod na OpenAI Realtime](https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create) · [ceník](https://developers.openai.com/api/docs/pricing)
- [Katalog Azure Speech](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?tabs=tts) · [SSML](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/speech-synthesis-markup-voice) · [ceník](https://azure.microsoft.com/cs-cz/pricing/details/speech/)

## Výkon a paměť

| Zkouška | Co změřit |
| --- | --- |
| Android, VOICE-06 (reference uživatele) | FP16 M2. Načtení 183,3 s. Syntéza 25,0 s. Konec přehrávání 216,0 s od spuštění. |
| VOICE-07, první běh + opakování | Po načtení zůstávají všechny čtyři ONNX relace v jednom workeru. Protokol zachytí načtení, syntézu, průběh po frázích, celkový čas do připraveného WAV, opakované použití a chyby. |
| 4 a 8 kroků FP16 | Při stejném profilu změřit alespoň tři opakování a porovnat medián i českou srozumitelnost. Nižší počet kroků zkracuje smyčku odšumování. Celkový čas ovlivňuje i délka repliky, vokodér a počet frází. |
| Předgenerované repliky | Stránka drží nejvýše deset WAV ukázek v paměti. Hodí se pro pevné znělky nebo obecné předěly. Záznam s konkrétním skóre či střelcem generovat až po ověření události. |
| Ukončení | Při chybě, přerušení, změně modelu, zavření stránky nebo 120 s nečinnosti se worker ukončí. Ruční uvolnění nebo odchod ze stránky odstraní i přehrávače a jejich Blob URL. Okamžité vrácení fyzické paměti závisí na prohlížeči. |

## Postup na Androidu

1. Spustit `python3 -m http.server 8765` v checkoutu větve. Na telefonu používat stejnou Wi-Fi a otevřít `http://IP-POČÍTAČE:8765/voice-07-test.html`. Pro tlačítko kopírování přes Clipboard API použít zabezpečený HTTPS náhled. Protokol lze na HTTP označit a zkopírovat ručně.
2. Vybrat FP16 a stisknout **Načíst model**. Poté vytvořit neutrální a sportovní verzi každé situace s osmi kroky. Posoudit českou výslovnost, gradaci, důraz a přirozenost.
3. Srovnat čtyři a osm kroků u stejného textu. Stiskem **Uvolnit model a ukázky** a opětovným načtením zkusit nový worker na stejném telefonu.
4. Pro živý komentář prioritně porovnat M2 s Eleven v4 Turbo na stejných replikách. Na Androidu měřit čas od požadavku do prvního zvuku. Pro český sportovní přednes vybrat hlas až podle poslechu.
