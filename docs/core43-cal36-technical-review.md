# CORE43-CAL-36 — Technické ověření bez osobního svědka

CAL-36 umožňuje BANGERu opakovat offline kontrolu bez podpisu druhé osoby pod zápisem NHL a bez potvrzení nezávislého správce archivu. Používá vlastní plán a důkazy BANGERu a dvě časová razítka svázaná s původním podepsaným balíčkem. Původní CAL-30, CAL-34 a CAL-35 nadále poskytují přísnější režim. CAL-36 nikdy nevydává `trusted: true`.

1. Spusť stávající CAL-32 pro schválený zápas a ulož přesné bajty jeho předzápasového archivu i jeho SHA-256. Časová razítka od schválených služeb se opatřují před začátkem. Tato změna žádné služby nekontaktuje ani neaktivuje sběr.
2. Po zápase stáhni finální report a boxscore z pevných adres NHL pomocí CAL-33 `collect GAME_ID`. Ulož beze změny archiv a jeho SHA-256. Podpis samostatného ověřovatele se v tomto režimu nepoužívá. Otisk chrání vybraný archiv před následnou změnou. Obsah a čas jeho stažení jsou stále záznamy BANGERu a HTML NHL není podepsané.
3. Použij schéma `core43_cal36_dossier_v1` se stejným `packageBytes`, `registryBytes` a `timestamps` jako CAL-31. Vynech `nhlStart`. Použij technickou revizní politiku `core43_cal36_technical_review_v1` se stejnými poli jako CAL-30 kromě `nhlObserver`, který nahraď `nhlArchiveSha256`. Zbývají samostatné piny předzápasového archivu, revizní politiky a dva samostatně schválené TSA profily s certifikáty a CRL.

```sh
node scripts/core43_cal36_technical_review.cjs prepared.json dossier.json sources.json policy.json "$PREPARED_SHA256" "$POLICY_SHA256"
```

Ověřovač kontroluje ID, týmy, finální stav, shodu plánovaného času a skutečnou značku Start z reportu. U zápisů bez AM/PM používá dřívější z možných interpretací. Pokud obě razítka nepředcházejí i této dřívější možnosti a plánovanému začátku, případ odmítne. Přijatý výsledek s `conservative_am_pm_bound` neurčuje přesnou hodinu začátku. Chybějící nebo nepodporovaný údaj Start vede k odmítnutí. Pozitivní technický stav je `technical_verified`, testovací zůstává `simulation_verified`. Oba vracejí `trusted: false`; návratový kód procesu je nula při úspěšné technické kontrole nebo úspěšné simulaci.

Běžné večerní zápasy mohou vyžadovat jednoznačnější strojově čitelný zdroj, aby důkaz pořízený krátce před utkáním prošel. Historická generálka s čerstvými razítky zůstává negativním případem. Produkční použití vyžaduje schválené profily obou TSA a samostatné povolení spuštění.

## Kladná generálka v CI

Regrese používá podepsaný syntetický balíček, předzápasovou přípravu CAL-32, dvě skutečné lokální odpovědi RFC 3161, připnuté řetězce a podepsané CRL. Čas vydání razítek určuje aktuální čas OpenSSL. Datum utkání, místní report a časy jeho stažení jsou syntetické. Test ověřuje také spuštění příkazu CAL-36 a návratový kód.

| Testovací situace | Očekávaný výsledek |
| --- | --- |
| Pouze jedna interpretace času z reportu je slučitelná s časem stažení | `simulation_verified`, `single_report_time`, `trusted: false` |
| Obě interpretace jsou možné a obě razítka jsou před dřívější mezí i před plánovaným začátkem | `simulation_verified`, `conservative_am_pm_bound`, `trusted: false` |
| Obě interpretace jsou možné a razítka vznikla po konzervativní mezi | `rejected`, `cal30_timestamp_order`, `trusted: false` |
