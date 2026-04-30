@echo off
echo supsub: binary not installed. The postinstall step may have failed. 1>&2
echo Try: pnpm rebuild @supsub/cli  (or)  npm rebuild @supsub/cli 1>&2
exit /b 127
