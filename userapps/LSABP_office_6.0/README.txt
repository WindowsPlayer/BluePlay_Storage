LSaBP Office
============
Spustenie:
1. Rozbaľ ZIP.
2. Otvor index.html vo Firefoxe alebo Chrome.
3. Word a Excel fungujú lokálne bez servera.

Funkcie:
- Word editor s formátovaním, vkladaním textu a obrázkov cez Ctrl+V.
- Excel hárok s bunkami a základnými vzorcami SUM, AVERAGE, MIN, MAX.
- Automatické ukladanie do localStorage prehliadača.
- Export Wordu do HTML a univerzálneho .lsabp JSON.
- Export Excelu do CSV a .lsabp JSON.
- Nápoveda a tmavý vzhľad.

Integrácia s LSaBP OS:
Aplikácia voliteľne zavolá window.lsabpOS.saveFile({name, content, mime}), ak OS poskytne takýto JavaScript bridge. Bez bridge funguje export cez stiahnutie súboru. Pošli mi zdrojový kód/štruktúru LSaBP OS a prispôsobím ukladanie jeho skutočnému súborovému systému.

Novinky v rozšírenej verzii:
- Excel: šírku stĺpca zmeníš ťahaním pravého okraja hlavičky A, B, C...
- Excel: výšku riadka zmeníš ťahaním spodného okraja čísla riadka.
- Word: klikni na obrázok a použi tlačidlá − Obrázok / + Veľkosť / Pôvodná veľkosť; obrázok možno tiež ťahať za jeho pravý dolný okraj v podporovaných prehliadačoch.
- Excel: Načítať otvorí .lsabp, .json alebo .csv.
- Rozmery buniek, obsah dokumentov a názvy sa ukladajú automaticky lokálne a v exportovanom .lsabp.

LSaBP Orbit Office - rozšírená edícia
- Nový názov: LSaBP Orbit Office.
- Obrázky: vyber obrázok kliknutím, zobrazí sa 8 úchytov na zmenu veľkosti a stredový úchyt na presúvanie. Rohové úchyty menia šírku aj výšku; drž Shift na zachovanie pomeru strán. Tlačidlá veľkosť menia po 50 %.
- Excel: začína so 100 riadkami a 26 stĺpcami. Keď sa posunieš k spodnému alebo pravému okraju, hárok automaticky pridá ďalšie riadky a stĺpce. Nie je to obmedzené na malú predpripravenú tabuľku.
- Veľkosť riadkov a stĺpcov možno meniť ťahaním ich okrajov. Rozmery sa ukladajú do .lsabp.
- Lokálne automatické ukladanie; export .lsabp je prenosná záloha.
