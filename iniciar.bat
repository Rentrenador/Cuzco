@echo off
cd /d "%~dp0"
echo.
echo  Cuzco - Gestión de Clientes
echo  ===========================
echo.
echo  Iniciando servidor en http://localhost:3456
echo  Deja esta ventana abierta mientras uses la app.
echo  Para cerrar: Ctrl+C o cierra esta ventana.
echo.
start "" "http://localhost:3456"
python -m http.server 3456