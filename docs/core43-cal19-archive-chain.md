# CORE43-CAL-19 — offline řetězec důkazních archivů

Každý záznam ledgeru má sekvenční číslo, SHA-256 balíčku CAL-18B, otisk předchozího záznamu a vlastní SHA-256 nad jednoznačným JSON polem. `append` nejprve kryptograficky znovu ověří CAL-18B archiv a zkontroluje **externě uložený** poslední známý otisk. Nepřijme duplicitu. Soubor ledgeru nahrazuje atomickým rename z dočasného souboru.

```bash
# První zápis: PINNED_HEAD = 64 nul (GENESIS).
node scripts/core43_cal19_chain.cjs append ./private/ledger.jsonl ./private-evidence/<digest> <PINNED_HEAD>
# Nový head bezpečně zapište do nezávislého úložiště a teprve potom další append.
node scripts/core43_cal19_chain.cjs verify ./private/ledger.jsonl <EXTERNALLY_PINNED_HEAD>
node --test scripts/test_core43_cal19_chain.cjs
```

**Bezpečnostní omezení:** samotný hash-chain nezabrání podvržení kompletně přepsaného ledgeru. Ochrana proti rollbacku funguje jen pokud je head bezpečně uložen *mimo* ledger a nelze jej změnit spolu s ním. Aktuální prototyp je **single-writer only**, nemá zámek proti paralelním procesům, nezajišťuje atomické potvrzení externího pinu, nedokazuje nezávislost TSA ani trvalost zápisu po výpadku napájení. Při nesouladu pinu nepokračovat a nezahajovat živý pilot. Pro produkční archiv doplnit koordinovaný zámek, fsync nadřazeného adresáře, nezávislý podepsaný checkpoint a recovery protokol.

Nejsou prováděny žádné síťové operace ani zápisy do Supabase; CORE 4.2 a živý sběr se nemění.

## CAL-19B: exkluzivní zápis a obnova

`append` nyní vytváří adresářový zámek `LEDGER.lock` atomicky. Pokud zámek existuje, odmítne dalšího zapisovatele. Po atomickém přejmenování ledgeru provede `fsync` nadřazeného adresáře. Zámek po pádu procesu může zůstat: **neodstraňujte jej automaticky**; nejprve prověřte procesy a archiv.

`node scripts/core43_cal19_chain.cjs recover LEDGER EXTERNALLY_PINNED_HEAD` vrací `consistent` nebo `unconfirmed_append`, případně odmítne rollback/fork. `unconfirmed_append` znamená, že poslední záznam ledgeru navazuje na externě potvrzený head, ale nový head dosud nebyl externě potvrzen. Nejde o automatické schválení: operátor musí nezávisle ověřit archiv, stav důvěryhodného checkpointu a teprve potom ručně potvrdit nový head. Do té doby jsou další zápisy blokované.

Prototyp není distribuovaný zámek; funguje pouze pro procesy sdílející spolehlivý lokální souborový systém. Externí pin a ledger se stále nepotvrzují atomicky. Není povoleno automaticky odstraňovat zámek ani přepisovat pin při restartu.
