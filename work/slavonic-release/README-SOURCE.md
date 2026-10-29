# Исходники «Церковнославянский язык» 1.2.1

Предварительный выпуск 1.2.1: веб-приложение опубликовано на https://kirrrr-2423.github.io/slavonic/. Настольные исходники включены в репозиторий; новые установщики этим выпуском не создавались. Исправлены сохранение и применение замечаний, Unicode-проверка, возвратные глаголы и раскрытие титл у чисел. В практике 70 заданий: выбор ответа, выделение слов с основаниями, самостоятельный набор; повторение сохраняет первую попытку.

Архив содержит общий исходный проект, без Electron runtime и установщиков. Распакуйте его и выполняйте команды из корня `slavonic-source`. Готовые Mac 1.2.0, Windows 1.1.0 и опубликованный Web 1.1.1 остаются предыдущими выпусками. Факт успешной проверки исходников не подтверждает установку или запуск этих платформ.

## Общий источник и проверки

- `outputs/slavonic-demo/` — единственный редактируемый renderer: интерфейс, языковое ядро, словари, задания, шрифты и лицензии.
- `work/slavonic-release/app/` — подготовленная копия renderer и исходники Electron: `main.js`, `preload.js`, `migrate.js`, `floating-keyboard.js`.
- `work/slavonic-release/release.json` — общая версия, Electron, статус публикации и путь renderer.
- `prepare_release.py` — перенос общих файлов, генерация desktop HTML с CSP/миграцией и проверка хешей. Платформенные дополнения CSS хранятся отдельно в `desktop.css`.
- `work/slavonic-demo/tests/` и `work/slavonic-release/tests/` — регрессионные проверки. `build_practice.py` только валидирует текущие задания, не перезаписывает их.
- `.github/workflows/quality.yml` — CI исходного проекта. В GitHub workflow запускается для push и pull request; в архиве исходников он также включён как шаблон.

Нужны Python 3.12+ и Node.js 24+. Для правок renderer:

```sh
python3 work/slavonic-release/prepare_release.py
python3 work/slavonic-release/prepare_release.py --check
python3 work/slavonic-release/check_all.py
```

`--check` не записывает файлы. `prepare_release.py` не пересобирает установленные приложения и не трогает профили. После изменения исходников повторите подготовку, затем проверки.

## Веб / PWA

```sh
python3 work/slavonic-release/web/build_web.py
python3 work/slavonic-release/check_all.py --web
```

Генератор создаёт `work/slavonic-release/web/slavonic-web` и `outputs/Slavonic-1.2.1-Web.zip`. Все файлы и шаблон service worker участвуют в версии кеша. Существующий архив не перезаписывается: для следующего выпуска измените версию в `release.json` и снова подготовьте источники. Для пробных правок до упаковки проверяйте canonical renderer локальным HTTP-сервером.

Публикация не входит в команды. При обновлении PWA проверяется сохранение текста; другие открытые окна откладывают активацию. Межоконный сценарий проверяется моделями, но требует отдельного браузерного испытания на целевых браузерах.

## macOS, только Apple Silicon

Нужны macOS 13+, Command Line Tools со Swift, `ditto`, `sips`, `iconutil`, `codesign`, `hdiutil`, `lipo`. Загрузите официальный `electron-v45.1.0-darwin-arm64.zip` с https://github.com/electron/electron/releases/tag/v45.1.0 в `work/slavonic-release/downloads/`. Текстовый официальный `SHASUMS256.txt` включён; сборщик сверяет SHA-256.

```sh
python3 work/slavonic-release/prepare_release.py
python3 work/slavonic-floating-keyboard/tools/build.py
python3 work/slavonic-release/check_all.py
python3 work/slavonic-release/mac/build_mac.py
python3 work/slavonic-release/mac/verify_image.py
```

Нативные Info.plist и layout.json создаются генератором из текущего `KB.MAP`, Swift и таблицы надстрочных знаков. Helper bundle ID фиксированы по ролям и не меняются при повторной сборке. Результат — ARM64 DMG с ad-hoc подписью, без Developer ID и нотариализации. Intel-цели нет.

Плавающая клавиатура запускается кнопкой из основного окна. Разрешение Accessibility предоставляется пользователем. Для Word выберите Ponomar в документе. Автоматические тесты не отправляют ввод в чужие программы; фокус, полноэкранный режим и ввод в Word требуют ручной проверки.

## Windows x64 / ARM64

Нужны NSIS 3.13 и 7-Zip. Официальные Electron ZIP для `win32-x64` и `win32-arm64` положите в `work/slavonic-release/downloads/` под именами `windows-electron-v45.1.0-x64.zip` и `windows-electron-v45.1.0-arm64.zip`. Включённый `windows-SHASUMS256.txt` проверяется перед распаковкой.

Укажите путь к makensis через `SLAVONIC_MAKENSIS`, к 7-Zip через `SLAVONIC_7ZZ`. По умолчанию инструменты ищутся в прежнем рабочем каталоге `work/slavonic-keyboard/windows/tools/`; сами инструменты в архив не входят.

```sh
python3 work/slavonic-release/prepare_release.py
python3 work/slavonic-release/windows/build.py
python3 work/slavonic-release/windows/verify.py
```

NSIS получает версию из общей конфигурации. Проверяющий сценарий проверяет контейнер и байты payload, не эмулирует запуск Windows. Authenticode отсутствует; установка и запуск требуют испытания на Windows.

## Упаковка исходников

```sh
python3 work/slavonic-release/check_all.py --web
python3 work/slavonic-release/package_sources.py
```

Создаётся новый `outputs/Slavonic-1.2.1-source.zip` с манифестом SHA-256 для каждого файла. Упаковщик проверяет подготовленные источники, неизменность снимка, CRC и байты ZIP. Runtime, бинарные сборки, пользовательские данные, кеши, старые отчёты и служебные файлы не включаются.

Шрифты и SCI сохраняют собственные включённые лицензии. Источники справочника, словаря Дьяченко и упражнений перечислены в программе; поле MIT в package.json не переопределяет условия сторонних материалов. Electron/Chromium notices добавляются из официального runtime.
