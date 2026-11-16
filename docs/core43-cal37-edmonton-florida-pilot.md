# CORE43-CAL-37 — Příprava pilotu Edmonton @ Florida

Rozhodnutí při přípravě 16. listopadu 2026: živý pilot je blokovaný. Edmonton @ Florida nahrazuje dřívějšího kandidáta Dallas @ St. Louis pro tuto etapu. Výchozí commit CAL-36: `8bfe6933a7714a3c4fea317aab6fa848fd45118b`.

| Údaj | Hodnota |
| --- | --- |
| NHL Game ID | `2026020335`, potvrzené adresou oficiálního Gamecenter |
| Utkání | Edmonton Oilers (EDM) @ Florida Panthers (FLA), 17. listopadu 2026 |
| Plánovaný začátek | 17. listopadu 19:00 EST (`America/New_York`), 18. listopadu `00:00:00Z`, v Česku 01:00 SEČ |
| Okno sběru CAL-03/CAL-07 | 17. listopadu 23:45 až 18. listopadu 00:15 SEČ. Cíl je půlnoc SEČ. |
| Skutečný začátek | Zatím nedoložený. Po utkání je třeba získat finální Game Summary a boxscore. |

[Gamecenter](https://www.nhl.com/gamecenter/edm-vs-fla/2026/11/17/2026020335) · [Oficiální čas od NHL](https://www.nhl.com/news/nhl-nationally-televised-games-for-week-of-november-16-2026) · [NHL Game Summary](https://www.nhl.com/scores/htmlreports/20262027/GS020335.HTM) · [NHL boxscore](https://api-web.nhle.com/v1/gamecenter/2026020335/boxscore)

## Před utkáním

Přímá odpověď NHL API nebyla při přípravě dostupná. Na stroji s přístupem k NHL API potvrď čerstvý rozpis a ulož originál před vytvořením plánu. V soukromém pracovním adresáři spusť příkazy v shellu s `curl` a `jq`.

```sh
(
  set -euC
  umask 077
  curl --fail --silent --show-error --max-time 30 \
    https://api-web.nhle.com/v1/schedule/2026-11-17 > nhl-schedule-2026-11-17.json
  jq -e '
    [.gameWeek[] | select(.date == "2026-11-17") | .games[]
     | select(.awayTeam.abbrev == "EDM" and .homeTeam.abbrev == "FLA")]
    | if length == 1 and .[0].id == 2026020335
        and .[0].startTimeUTC == "2026-11-18T00:00:00Z"
      then .[0] | {id, startTimeUTC, gameState, gameScheduleState}
      else error("NHL schedule mismatch")
      end
  ' nhl-schedule-2026-11-17.json
)
```

Při změně rozpisu zastav přípravu a znovu posuď okno. V okamžiku sběru ověř stav zápasu a platnost plánu. Vyžádej si datovaný, schválený export v rozsahu [CAL-07](core43-cal07-signed-pregame-export.md) se zmrazeným základem CORE 4.2, sezónním GSAx a předzápasovými podklady k oběma brankářům. [Audit CAL-06](core43-cal06-readonly-readiness-audit.md) blokuje živou čtecí roli v dosavadním návrhu. Pro tento zápas zatím není doložen způsobilý zdrojový export.

CAL-03 po přijetí vstupů vrací čtyři varianty očekávaných gólů, koeficienty `0`, `0.005`, `0.02`, `0.03`, stav brankářů a informace o původu. Pravděpodobnost vítězství včetně prodloužení a nájezdů tento výstup neposkytuje. [CAL-11](core43-cal11-offline-accuracy.md) ji umí vyhodnotit pouze tehdy, když existuje odpovídající archivovaný výstup modelu. Zatím nevznikla predikce pro EDM–FLA.

Při splnění podmínek vytvoř balíček CAL-13 a použij připnutý plán [CAL-32](core43-cal32-pregame-preparation.md). Uchovej původní bajty balíčku, registru a žádostí, odpovídající odpovědi, certifikáty a podepsané CRL mimo veřejné artefakty. Předzápasový otisk ulož odděleně podle [CAL-34](core43-cal34-replay-binding.md). Živé žádosti smí odejít až po výslovném schválení uživatelem.

## Časové autority

CAL-31 a CAL-33 doložily kompatibilitu a rozdílné provozovatele, podpisové klíče a řetězce GlobalSign R45 a Sectigo Qualified. Dvojice zatím není schválená pro pilot. Sectigo v odpovědi podpory uvedlo, že by zadaný endpoint měl být pro tento případ dostupný zdarma, bez samostatné smlouvy. GlobalSign zatím nepotvrdil konkrétní použití a podmínky. Oddělený provoz obou služeb vyžaduje doložení a schválení profilů. Dosavadní veřejné vzorky DigiCert a FreeTSA postrádaly podepsanou přesnost, kterou CAL-16 vyžaduje. Zjištění neposkytují hotovou alternativu.

[Audit poskytovatelů CAL-33](core43-cal33-pilot-audit.md#časové-autority) · [Pozorované odpovědi CAL-31](core43-cal31-pilot-rehearsal.md#candidate-authorities) · [Katalog CAL-30](core43-cal30-tsa-candidates.json)

## Skutečný začátek a offline kontrola

Pokud finální zápis použije formát například `Start 7:08 EST` bez údaje AM/PM, CAL-36 vyhodnotí jako bezpečnou mez i dopolední interpretaci 07:08 EST, tedy 13:08 SEČ 17. listopadu. Večerní razítka pak neprojdou. Uvedená minuta je příklad formátu. Pro úspěšnou technickou kontrolu je třeba ověřit jednoznačný oficiální zdroj skutečného začátku a jeho podporu v ověřovači. Plánovaný začátek z API má vlastní kontrolu a sám neřeší tuto nejednoznačnost.

Po zápase lze ručně archivovat finální podklady příkazem CAL-33. V soukromém adresáři bez přepisu spusť z kořene repozitáře s cestami k souborům evidence:

```sh
(
  set -euC
  umask 077
  node scripts/core43_cal33_nhl_observer.cjs collect 2026020335 > sources.json
)
node scripts/core43_cal36_technical_review.cjs prepared.json dossier.json sources.json policy.json \
  "$PREPARED_SHA256" "$POLICY_SHA256"
```

Generálka, kterou lze provést ihned na Node.js 22 a OpenSSL, je stejná regrese, kterou spouští CAL-04. Zahrnuje balíček, lokální časová razítka RFC 3161, kontrolu řetězců a CRL a kladné i záporné případy časové posloupnosti. Výsledkem kladného scénáře je `simulation_verified` s `trusted: false`. CAL-36 rovněž zachovává `trusted: false` pro případné `technical_verified` bez osobního svědka.

```sh
node --test scripts/test_core43_cal30_historical_trust.cjs scripts/test_core43_cal33_nhl_observer.cjs
```
