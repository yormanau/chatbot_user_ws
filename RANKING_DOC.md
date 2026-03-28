# 📊 Ranking de Clientes

## ¿Qué datos usa?

El sistema trae todos los clientes con sus facturas y calcula para cada uno:

- **Cantidad de compras** — número de facturas
- **Gasto total** — suma de todas sus facturas
- **Días desde la última compra**

> La **ventana de tiempo configurable** filtra qué facturas se cuentan. Si está en "Últimos 30 días", solo se evalúan las compras de ese período.

---

## 🏅 Criterios de asignación de tier

Los tiers se evalúan de **mayor a menor**. El cliente cae en el primero que cumpla:

### 💎 VIP
No tiene un umbral fijo. Se calcula **dinámicamente**: se toma el top X% (por defecto **10%**) de los clientes con mayor gasto total. El umbral es el gasto del cliente que queda en el límite de ese porcentaje.

> **Ejemplo:** con 100 clientes y VIP = 10%, los 10 que más gastaron son VIP.

### 🥇 Gold
Cumple **cualquiera** de las dos condiciones:
- ≥ 7 compras, o
- ≥ $500.000 en gasto total

### 🥈 Silver
Cumple **cualquiera** de las dos condiciones:
- ≥ 3 compras, o
- ≥ $200.000 en gasto total

### 🥉 Bronze
- ≥ 1 compra

### 🆕 Nuevo
- Nunca ha comprado (0 compras)

---

## ⬇️ Degradación automática (opcional)

Si está activada: si un cliente lleva más de **N días** sin comprar, **baja un nivel** al recalcular.

> **Ejemplo:** un Gold que lleva 45 días inactivo (con degradación en 30 días) pasa a Silver.

---

## ⚙️ Configuración

Desde el panel de configuración (engranaje ⚙) se puede cambiar:

| Parámetro | Descripción |
|---|---|
| Ventana de tiempo | Período de facturas a evaluar |
| % para VIP | Porcentaje del top de clientes |
| Umbrales Gold / Silver / Bronze | Compras y gasto mínimos por tier |
| Días de degradación | Inactividad máxima antes de bajar de nivel |

Los cambios se guardan y se aplican en el próximo recálculo.