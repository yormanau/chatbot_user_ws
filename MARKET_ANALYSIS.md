# Análisis de Mercado — WhatsApp CRM Bot

## ¿Qué es este producto?

Un **WhatsApp CRM + Sistema de ventas** todo-en-uno para negocios pequeños/medianos:

- Auto-registro de clientes por WhatsApp
- Gestión de contactos con historial de compras
- Facturación e inventario básico
- Analytics avanzados (tendencias, ranking de clientes, combos, tiers VIP/Gold/Silver)
- Panel personalizable con branding propio

---

## Competencia directa y sus precios

| Producto | Precio/mes | Lo que ofrece |
|---|---|---|
| WATI | $49–$99 USD | Solo mensajería WhatsApp, sin CRM real |
| Respond.io | $79–$249 USD | CRM omnicanal, más complejo |
| Kommo (amoCRM) | $15–$45/usuario | CRM sin WhatsApp nativo |
| Treble.ai | $150–$500 USD | Automatización WhatsApp LATAM |
| Sirena | $100–$300 USD | WhatsApp + CRM básico LATAM |

> Este producto tiene un nicho más específico y asequible: negocios que quieren WhatsApp + ventas + analytics sin pagar $100+/mes.

---

## Precios sugeridos

### En USD (ideal para escalar)

| Plan | Precio/mes | Incluye |
|---|---|---|
| **Básico** | $19–$25 | Bot + Contactos + Facturación |
| **Pro** | $39–$49 | Todo + Analytics avanzados + Tiers |
| **Business** | $69–$89 | Todo + Personalización branding + Soporte prioritario |

### En COP (Colombia)

| Plan | Precio/mes |
|---|---|
| Básico | $75.000–$100.000 |
| Pro | $150.000–$200.000 |
| Business | $270.000–$350.000 |

---

## Costos operativos estimados

### Por cliente/mes

| Costo | Estimado |
|---|---|
| Railway (server + DB) | $3–$8 USD |
| Soporte / mantenimiento | $2–$5 USD (a escala) |
| **Total por cliente** | **~$5–$13 USD** |

### Proyección de ingresos (Plan Pro a $45/mes)

| Clientes | Ingresos brutos | Ganancia neta (~80%) |
|---|---|---|
| 20 | $900 USD/mes | ~$720 USD/mes |
| 50 | $2.250 USD/mes | ~$1.800 USD/mes |
| 100 | $4.500 USD/mes | ~$3.600 USD/mes |

---

## Consideraciones

### A favor
- Margen muy alto (80–90%) porque la infraestructura es barata
- Nicho desatendido: negocios pequeños que ya usan WhatsApp para vender (ferreterías, salones, talleres, restaurantes, tiendas)
- El producto ya tiene suficientes features para cobrar $39–$49/mes sin problema
- El sistema de tiers VIP/Gold/Silver es un diferenciador real que pocos competidores tienen a ese precio

### Riesgos a considerar
- `whatsapp-web.js` es una librería no oficial — WhatsApp puede bloquear números o cambiar su API sin aviso. Riesgo operativo real al escalar a muchos clientes en el mismo servidor
- Para escalar a 20+ clientes se necesita arquitectura multi-tenant (cada cliente con su propia instancia/número)
- La competencia con API oficial de Meta (WhatsApp Business API) es más estable pero más cara

---

## Go-to-market recomendado

Empezar con **$39–$49/mes** apuntando a negocios físicos pequeños en Colombia:
- Salones de belleza
- Talleres mecánicos
- Tiendas y ferreterías
- Restaurantes y cafeterías

Estos negocios ya usan WhatsApp activamente para vender y no tienen un sistema para gestionar esos clientes. El pain point es claro y el precio es accesible.
