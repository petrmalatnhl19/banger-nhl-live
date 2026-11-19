# CORE43-CAL-34 — Vazba předzápasového archivu na offline ověření

CAL-34 porovnává přesné bajty balíčku, registru a každé ze dvou žádostí mezi předzápasovým výstupem CAL-32 a dossier CAL-31. Páruje žádosti podle ID autority. Pořadí položek je libovolné. Dvojice duplicitních ID, pozměněná žádost, záměna žádostí mezi službami nebo změna OID mezi přípravou a přezkumem znamenají odmítnutí.

1. Po úspěšném CAL-32 zachovej přesný soubor `prepared.json` včetně případného koncového LF. Jeho SHA-256 ulož odděleně pod kontrolou schváleného správce evidence. Při přezkumu otisk převezmi z tohoto nezávislého záznamu. Otisk vypočtený až ze souboru dodaného k přezkumu tuto vazbu nedokládá.
2. Sestav dossier CAL-31 s původními žádostmi a odpověďmi od jednotlivých služeb. Podpis původu reportu NHL zkontroluj příkazem [CAL-33](core43-cal33-pilot-audit.md#nhl-podklad-a-jeho-integrita). Připrav samostatnou schválenou politiku CAL-30 a její nezávisle uložený otisk.
3. Proveď kontrolu offline.

```sh
node scripts/core43_cal34_replay_prepared.cjs prepared.json dossier.json policy.json \
  "$APPROVED_PREPARED_SHA256" "$APPROVED_POLICY_SHA256"
```

Příkaz po porovnání předává **stejné jednou načtené a dekódované bajty** původnímu kryptografickému ověřovači CAL-30. Úspěšné porovnání dodává do výsledku otisky přípravy a plánu. Samo nedokládá čas vytvoření archivu a nenahrazuje původní kontrolu předzápasových tokenů, řetězců, revokace a dokladu NHL. Návratový kód je nula pouze při `trusted: true`. Platná simulace končí jako `simulation_verified` s `trusted: false` a návratovým kódem jedna. Původní CAL-31 zůstává dostupný pro reprodukci starších offline auditů.

Regrese zahrnují přesnou shodu, permutaci autorit, přepsání archivu, nesprávný otisk politiky, změněný balíček a registr, duplicitu autority, záměnu či nahrazení žádostí a odmítnutí cizí odpovědi i při shodě archivu. Simulace používají dočasné klíče a lokální TSA.

Před živým během zbývá schválit obě TSA včetně podmínek použití a provozní nezávislosti, zajistit trvalý nezávislý záznam otisku a svěřit klíč NHL ověřovateli. Jeden budoucí zápas lze vybrat po splnění těchto podmínek.
