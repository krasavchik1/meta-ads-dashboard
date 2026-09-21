Meta Ads Analytics Dashboard

Установка проекта для разработчика

После клонирования репозитория разработчик создает отдельное Python-окружение проекта:

python3 -m venv .venv

Активирует его:

source .venv/bin/activate

Устанавливает зависимости:

pip install -r requirements.txt

После этого в папку проекта помещается Meta CSV/XLS/XLSX.

Запуск:

python3 analyzer.py

После успешного запуска должен быть сгенерирован:

REPORT.html

Внутренняя система аналитики рекламных данных Meta Ads.

Что делает проект

Проект получает экспорт Meta Ads в формате CSV/XLS/XLSX, приводит данные к единому внутреннему формату, применяет бизнес-правила, рассчитывает производные показатели и формирует локальный HTML-dashboard.

Текущие источники данных:

Meta CSV

Meta XLS

Meta XLSX

Meta API пока не реализован и будет подключаться отдельным этапом.

Как сейчас работает проект

Логика проекта:

Meta Ads export
→ импорт
→ нормализация данных
→ применение business rules
→ аналитические расчеты
→ генерация REPORT.html

Leads

В текущей версии Leads не рассчитываются из кликов или показов.

Используется следующая логика:

Meta Results → meta_results → payable_results → leads

Activity Rule

Строка учитывается в аналитике, если:

Spend > 0 OR Leads > 0

Строка игнорируется, если:

Spend = 0 AND Leads = 0

Financial Metrics

Revenue = Leads × Payout

При включенном Agency Fee:

Actual Spend = Spend × 1.08

При выключенном Agency Fee:

Actual Spend = Spend

Profit = Revenue - Actual Spend

ROI = Profit / Actual Spend × 100%

CPA = Spend / Leads

CR = Leads / Link Clicks × 100%

Основные файлы проекта

analyzer.py
— основной entry point. Запускает обработку данных и генерацию отчета.

data_engine.py
— импорт, разбор и нормализация данных Meta.

analytics_engine.js
— аналитические расчеты и агрегации.

app.js
— логика dashboard и пользовательских взаимодействий.

styles.css
— стили dashboard.

business_rules.json
— конфигурация бизнес-правил: Agency Fee, payout rules, GEO и другие настройки.

requirements.txt
— Python-зависимости проекта.

.gitignore
— определяет файлы, которые нельзя отправлять в GitHub.

Business Rules

Основные изменяемые бизнес-правила находятся в:

business_rules.json

Этот файл является источником истины для конфигурируемых правил.

В частности, там находятся:

Agency Fee;

Offer result source;

payout;

GEO payout overrides;

supported GEO codes.

Бизнес-правила не должны дублироваться в нескольких местах кода.

Входные файлы Meta

Meta CSV/XLS/XLSX используются только как локальные входные данные.

Их не нужно загружать в GitHub.

Можно положить актуальную выгрузку Meta в папку проекта и запустить обработку.

Название входного файла не имеет значения для GitHub: .gitignore исключает любые файлы с расширениями:

.csv

.xls

.xlsx

Сгенерированный отчет

После запуска проекта формируется:

REPORT.html

Это локальный результат работы программы.

HTML-отчет не должен загружаться в GitHub.

.gitignore исключает любые .html файлы.

Папка .venv создается только локально и не загружается в GitHub.

Что не должно попадать в GitHub

Нельзя загружать:

любые .csv;

любые .xls;

любые .xlsx;

любые сгенерированные .html;

**pycache**;

.venv;

локальные IDE-файлы;

секреты и API keys.

Текущая структура репозитория

В GitHub должны находиться:

analyzer.py
data_engine.py
analytics_engine.js
app.js
styles.css
business_rules.json
requirements.txt
README.md
.gitignore

Локально дополнительно могут находиться:

Meta_Export.csv
Meta_Export.xlsx
REPORT.html
.venv/
**pycache**/

Они не должны попадать в GitHub.

Текущие бизнес-правила

Offer 418

Default payout:

$0.25

Geo overrides:

ZW — $0.15

UY — $0.15

CO — $0.15

PE — $0.15

PY — $0.15

DO — $0.15

PA — $0.15

EC — $0.15

Offer 339

Fallback payout отсутствует.

Payout определяется по GEO:

BR — $2.15

BD — $2.80

ID — $2.63

MX — $1.88

TH — $1.38

ZA — $1.70

ZW — $2.00

Если для Offer 339 GEO отсутствует в конфигурации, payout считается не настроенным.

Важные правила разработки

Оригинальное название кампании сохраняется в campaign.

unified_name является отдельным нормализованным полем.

Campaign ID рекомендуется хранить как String.

Campaign ID нельзя округлять, обрезать или менять по точности.

Для будущей multi-account архитектуры идентификатор кампании должен учитывать ad_account_id + campaign_id.

All/All не должен суммироваться поверх детальных Age/Gender строк.

Все виджеты должны использовать общую бизнес-логику.

CSV/XLS/XLSX и будущий Meta API должны использовать один normalization layer.

Будущее развитие

Планируемые этапы:

Meta API integration;

поддержка нескольких рекламных аккаунтов;

ежедневная синхронизация;

backfill последних дней;

upsert вместо безусловного append;

автоматическое обновление данных.

Важно

Этот репозиторий содержит код и конфигурацию проекта.

Реальные рекламные выгрузки Meta и сгенерированные отчеты в репозиторий не добавляются.
