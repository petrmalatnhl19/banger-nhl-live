# CORE43-CAL-18B — offline archiv důkazů RFC 3161

Tato etapa přidává offline archivaci přesných bajtů podepsaného balíčku, TSQ, TSR a důvěryhodného kořene. Archiv se vytváří až po úspěšném kryptografickém ověření z CAL-16. Vytvoří adresář pojmenovaný SHA-256 balíčku a `manifest.json` s otisky, délkami, profilem TSA a konzervativní horní časovou mezí. Ověření archivu znovu přepočítá otisky i podpis razítka.

Příklad použití (pouze na schváleném **offline** důkazním souboru):

```bash
node scripts/core43_cal18_archive.cjs archive ./private-evidence ./bundle.json ./request.tsq ./response.tsr ./authority.json
node scripts/core43_cal18_archive.cjs verify ./private-evidence/<sha256-bundle>
```

`authority.json` musí obsahovat `kind: "independent"`, `policyOid`, `signerFingerprint256`, `maxAccuracyMs` a `caFile` (cesta k důvěryhodnému CA PEM). Kořen musí být ověřen mimo balíček; nikdy mu nedůvěřovat jen proto, že byl dodán spolu s razítkem.

**Důležité hranice:** Úspěšné `verify` prokazuje kryptografickou konzistenci, nikoliv skutečnou nezávislost poskytovatele TSA, stav odvolání certifikátu, pravost oficiálního času začátku zápasu nebo právní kvalitu časového razítka. Manifest výslovně obsahuje `independentOperationProven: false` a `officialGameStartVerified: false`. Archiv není WORM úložiště ani dlouhodobý LTV důkaz. Je třeba přidat externí audit TSA, ověření revokace a nezměnitelné úložiště mimo tento prototyp.

Používat jen důvěryhodný soukromý adresář s přístupem jednoho procesu; neumožnit souběžné zapisování ani úpravy jiným uživatelům. Neukládat produkční soukromé klíče. Žádný živý sběr, žádné zápisy do Supabase, žádné nasazení ani změna CORE 4.2.

Test: `node --test scripts/test_core43_cal18_archive.cjs`.
