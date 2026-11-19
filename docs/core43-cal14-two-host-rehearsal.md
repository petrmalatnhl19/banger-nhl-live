# CORE43-CAL-14 zkouška na dvou strojích

CAL-14 používá syntetický zápas, krátkodobé testovací klíče a existující ověřování CAL-07, CAL-12 a CAL-13. Balíček je označený `simulation`. Živá úloha CAL-04 zůstává vypnutá.

## Co ověřuje GitHub Actions

Úloha `rehearsal-export` vytvoří testovací balíček na prvním hostovaném virtuálním stroji. Krátkodobý artefakt obsahuje tři soubory s podepsaným balíčkem, podepsaným registrem a veřejným klíčem. SHA-256 balíčku a otisk veřejného klíče se předají odděleně jako výstupy úlohy. `rehearsal-receive` na novém virtuálním stroji stáhne artefakt, ověří otisky a podpisy, zkontroluje oddělené čtecí a předávací oprávnění přes lokální TLS, zahodí odpověď po potvrzení zápisu a znovu otevře koordinátor. Opakované doručení musí vrátit `duplicate` a evidence musí zachovat všechny čtyři varianty. Hostované joby používají samostatné virtuální stroje. [GitHub-hosted runners](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners)

Artefakt je testovací transport určený pro syntetické soubory. Přímé privátní HTTPS spojení mezi dvěma stroji se testuje samostatným postupem níže. Koordinátor při zkoušce používá vlastní lokální SQLite, bez sdíleného souboru mezi stroji.

## Přímá zkouška v privátní síti

Předpoklad je Node.js 22 na obou strojích a soukromé síťové spojení ze stroje B na stroj A. A potřebuje testovací TLS certifikát s privátní IP v SAN, nebo certifikát pro testovací DNS, které na tuto IP ukazuje. Na B ověřujte certifikát pomocí veřejného certifikátu důvěryhodné testovací autority. Příjemce dostane nezávisle ověřený otisk balíčku a autority. Přístupy pro čtení balíčku a předání koordinátoru jsou dva různé dočasné tokeny. Tokeny předávejte mimo artefakty a logy. Konfigurační soubory i soukromý klíč uložte s oprávněním `0600` a adresář databáze s `0700`.

1. **A vytvoří syntetický balíček.**

   ```bash
   node --experimental-sqlite scripts/core43_cal14_rehearsal.cjs prepare ./exchange
   ```

   Výstup vrátí `digest` a `rootFingerprint`. Předejte SHA-256 balíčku B ověřeným kanálem. Koordinátor na A použije i ověřený otisk kořenového veřejného klíče. Složka `exchange` na A obsahuje balíček a veřejné podklady, podpisové soukromé klíče se nikam neukládají.

2. **A spustí testovací server.** V `authority.json` nastavte `host` na privátní IPv4, `port`, `certPath`, `keyPath`, `statePath` v soukromém adresáři, `readToken`, `submitToken`, `init: true` a `dropAfterCommit: true`. Server odmítá poslouchat na veřejné nebo všeobecné adrese.

   ```bash
   node --experimental-sqlite scripts/core43_cal14_rehearsal.cjs serve \
     ./exchange "$DIGEST" "$ROOT_FINGERPRINT" ./authority.json
   ```

3. **B stáhne balíček a předá ho koordinátoru.** V `receiver.json` nastavte `origin` na důvěryhodnou testovací HTTPS adresu A, `certPath` na důvěryhodný veřejný certifikát a oba odpovídající testovací tokeny. Při prvním volání má po potvrzení zápisu spojení skončit chybou.

   ```bash
   node --experimental-sqlite scripts/core43_cal14_rehearsal.cjs receive ./receiver.json "$DIGEST"
   ```

4. **A restartuje server nad stejným `statePath`** s `init: false` a `dropAfterCommit: false`. B zopakuje stejný příkaz `receive`. Musí vrátit `duplicate`. Na A ověřte všechny čtyři koeficienty.

   ```bash
   node --experimental-sqlite scripts/core43_cal14_rehearsal.cjs inspect \
     ./exchange "$DIGEST" "$ROOT_FINGERPRINT" "$STATE_PATH"
   ```

Po zkoušce server ukončete a dočasné přístupy odstraňte. Tento testovací server je určen jen pro izolovanou zkoušku syntetického balíčku a předání bez produkčních oprávnění.

## Zdroje pro ostrý pilot

Podle auditu CAL-06 má nová role v projektu `app-development` přístup ke schématu `net` přes oprávnění `PUBLIC`. Návrh migrace přístup zastaví. CAL-14 tuto hranici nemění. K posouzení zbývá již schválený exportní zdroj omezený na 30 sloupců a pět projekcí CAL-07, případně samostatný zdroj bez těchto sdílených oprávnění. Dokumentace počítá s exportérem mimo GitHub Actions, soukromým úložištěm, nezávislým časovým potvrzením, trvalým koordinátorem a obnovou z kontrolního bodu. Ke sběru skutečných predikcí je stále třeba schválený zdroj i výslovné povolení živého pilotu. [Audit CAL-06](core43-cal06-readonly-readiness-audit.md) · [Návrh CAL-13](core43-cal13-collection-infrastructure.md)
