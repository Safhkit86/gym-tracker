# progress-service (Fase 3)

Storico degli allenamenti completati e motore di regole di progressione
(progressive overload): valuta le regole configurate per ogni esercizio e
pubblica un evento quando una regola scatta (es. "aumenta il carico di 2.5kg").

Non ancora implementato: verrà costruito nella Fase 3, introducendo RabbitMQ
per pubblicare gli eventi consumati da `notify-service`.
