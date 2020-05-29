# Instalación

## Dependencias 
Para la instalación es necesario tener instalado `git` y `curl` (ya deberían estar en cualquier Mac moderno)

Instalamos `nvm`, la versión 12.16.3 de `node` y `yarn`

```
# Instalación nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.35.3/install.sh | bash

# Instalación node
nvm install 12.16.3

# Configuración de node por defecto
nvm alias default 12.16.3

# Instalación yarn
npm install -g yarn
```

## Instalación herramienta

```
cd ~
git clone https://github.com/ramirost/adraba_tools
```

# Actualización

Si hay alguna actualización hay que situarse en el directorio donde se haya descargado y ejecutar:

```
cd ~/adraba_tools
git pull
```

# Uso

Antes del primer uso en el directorio donde se haya descargado ejecutar.

```
cd ~/adraba_tools
yarn
```

Mientras no haya cambios en el código del programa para generar un informe ejecutar.

```
cd ~/adraba_tools
yarn c3 --entrada directorioDeArchivosMail --salida archivo.csv
```

Ejemplo con la muestra incluida en el repositorio:

```
cd ~/adraba_tools
yarn c3 --entrada ~/adraba_tools/samples/ --salida ~/ejemplo_c3.csv
```

El resultado estará en el archivo `ejemplo_c3.csv` del directorio del usuario.