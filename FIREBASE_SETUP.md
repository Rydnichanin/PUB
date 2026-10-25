# Firebase для Alley PUB

Пошаговая настройка находится в [README.md](README.md#подключение-firebase). Правила доступа — в `firestore.rules`. Создайте Authentication с Email/Password и Cloud Firestore, затем примените правила.

Коллекции: `users`, `customerDirectory`, `products`, `orders`, `settings` и `auditLogs`. В текущей версии сумма заказа вычисляется в браузере. Перед подключением онлайн-оплаты добавьте серверный пересчёт цены и интеграцию с платёжным провайдером.
