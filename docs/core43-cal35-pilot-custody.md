# CORE43-CAL-35 — Potvrzení správce předzápasového archivu

CAL-35 připravuje samostatné podepsané potvrzení o převzetí přesných bajtů předzápasového archivu CAL-32. Váže SHA-256 archivu, otisk plánu, ID utkání, plánovaný začátek a identifikátor konkrétní uložené verze. Při offline ověření se klíč správce porovná s nezávisle získaným otiskem Ed25519 SPKI. Ověřovač odmítá klíč shodný s klíčem ověřovatele NHL nebo s klíčem z registru predikce, včetně kořene registru.

Správce uloží vyzvednuté přesné bajty a teprve poté podepíše potvrzení. Před podpisem musí ověřit, že `custodyRef` označuje skutečně uloženou verzi. Příkaz pracuje lokálně. Podpis dosvědčuje převzetí podle hodin správce. Trvanlivost, neměnnost a provozní oddělení úložiště vyžadují samostatně doloženou správu. Ověřovač kontroluje, že potvrzení předchází dřívějšímu z plánovaného a skutečného začátku.

```sh
(umask 077
 set -C
 node scripts/core43_cal35_archive_receipt.cjs sign prepared.json custodian-private.pem "$CUSTODY_REF" > receipt.json)
node scripts/core43_cal35_archive_receipt.cjs replay prepared.json dossier.json policy.json \
  "$APPROVED_POLICY_SHA256" receipt.json custodian-public.pem "$APPROVED_CUSTODIAN_SPKI_SHA256"
```

Při přezkumu stále ověř zdrojový archiv NHL postupem [CAL-33](core43-cal33-pilot-audit.md#nhl-podklad-a-jeho-integrita). CAL-35 se předá původní archiv, dossier, politika a její samostatně získaný otisk. Potvrzení dodá otisk předzápasového archivu pro CAL-34. CAL-34 následně provede stejné porovnání žádostí a kryptografickou kontrolu CAL-30. Platná simulace vrací `trusted: false` a návratový kód jedna.

## Podklady ke schválení jednoho pilotu

| Rozhodnutí | Co doplnit před pilotem |
| --- | --- |
| GlobalSign R45 a Sectigo Qualified | Pro každý konkrétní endpoint požadované oprávnění pro použití s predikčním balíčkem, cenu nebo potvrzení bezplatnosti, limity a doložené provozní oddělení. Identitu, dokumentaci i pozorované profily obsahuje [audit CAL-33](core43-cal33-pilot-audit.md#časové-autority). |
| Nezávislý ověřovatel NHL | Určit odpovědnou osobu a její samostatně spravovaný klíč. Doložit, že po zápase získá a podepíše zdroj CAL-33 nezávisle na vydavateli predikce. |
| Správce předzápasového archivu | Určit správce, verzi spravovaného úložiště nebo verzi uloženého objektu, dobu uchování a způsob distribuce otisku veřejného klíče. Soukromý klíč je u správce. |
| Jediný budoucí zápas | Po schválení předchozích bodů vybrat utkání, připnout předzápasový plán a připravit CAL-32. Výsledný důkaz po utkání přehrát přes CAL-35 s externě připnutou revizní politikou CAL-30. |

Živý běh a získání razítek se v CAL-35 nespouštějí. Regresní zkoušky používají dočasné klíče i dvě lokální TSA. Pokrývají změnu archivu nebo potvrzení, záměnu klíče, sdílený klíč s ověřovatelem NHL a převzetí na hranici skutečného či plánovaného začátku.
