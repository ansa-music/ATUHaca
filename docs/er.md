# ER-диаграмма Qadir

```mermaid
erDiagram
    organizations ||--o{ profiles : "ответственные лица"
    organizations ||--o{ waste_types : "свой перечень"
    organizations ||--o{ reports : "сдаёт"
    organizations ||--|| org_secrets : "токен весов"
    organizations ||--o{ daily_portions : "порций в день"
    organizations ||--o{ surplus_offers : "спасённые порции"
    organizations ||--o{ scale_readings : "показания весов"
    reports ||--o{ entries : "взвешивания"
    reports ||--o{ status_history : "история"
    waste_types ||--o{ entries : "вид отхода"
    disposal_methods ||--o{ entries : "способ утилизации"
    disposal_methods ||--o{ waste_types : "по умолчанию"
    profiles ||--o{ entries : "ответственный"
    profiles ||--o{ status_history : "кто изменил"
    entries ||--o| entry_photos : "фото"

    organizations {
        uuid id PK
        text name_ru
        text name_kk
        text type "lab, canteen, cafe, hotel"
        text building
        bool is_active
        bool is_demo
    }
    profiles {
        uuid id PK "= auth.users.id"
        text full_name
        text email
        enum role "responsible, reviewer, admin, management"
        uuid org_id FK
    }
    waste_types {
        uuid id PK
        uuid org_id FK "null = общий"
        text name_ru
        text unit "kg, l"
        uuid default_disposal_id FK
        bool recyclable
        text category "avoidable, unavoidable, packaging"
        numeric co2_factor
        numeric cost_per_unit
        bool is_active
    }
    disposal_methods {
        uuid id PK
        text name_ru
        bool diverts "уводит от захоронения"
    }
    reports {
        uuid id PK
        uuid org_id FK
        date period_start
        date period_end
        enum status "draft, submitted, in_review, accepted, returned"
        timestamptz submitted_at
        uuid reviewer_id FK
        timestamptz decided_at
    }
    entries {
        uuid id PK
        uuid report_id FK
        uuid org_id FK
        date entry_date
        uuid waste_type_id FK
        numeric quantity
        uuid disposal_id FK
        text reason
        uuid user_id FK
        bool has_photo
        text source "manual, photo, scale"
        timestamptz created_at
    }
    status_history {
        bigint id PK
        uuid report_id FK
        enum from_status
        enum to_status
        uuid user_id FK
        text comment
        timestamptz created_at
    }
```

Правила модели:

- итоги за день и месяц нигде не хранятся — они считаются из `entries`;
- единый реестр — представление `registry`: записи отчётов со статусом `accepted`;
- вид отхода, по которому есть записи, нельзя удалить — только отключить (`is_active`);
- статус отчёта меняют только серверные функции, каждая смена пишется в `status_history`.

## Статусы отчёта

```mermaid
stateDiagram-v2
    [*] --> draft: первая запись месяца
    draft --> submitted: ответственный отправляет
    submitted --> in_review: проверяющий открыл
    in_review --> accepted: принять
    in_review --> returned: вернуть (комментарий обязателен)
    submitted --> accepted
    submitted --> returned
    returned --> submitted: исправлено и отправлено повторно
    accepted --> [*]: данные в едином реестре, отчёт закрыт
```
