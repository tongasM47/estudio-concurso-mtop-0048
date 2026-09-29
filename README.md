# Concurso MTOP 0048/2026 – App de estudio

App web para preparar la **prueba de oposición** del Llamado 0048/2026 del Ministerio de Transporte y Obras Públicas: Administrativo V, Gestor/a Administrativo (Esc. C, Gdo. 01). La prueba vale 50 de 100 puntos y se toma del 26 al 30 de octubre de 2026.

## Temario cubierto (Acta N° 1)

| Norma | Alcance | Artículos |
|---|---|---|
| Constitución de la República | arts. 82-85, 88-103, 149-168 y 233 | 41 |
| Decreto 500/991 | completo (arts. 1-239) | 239 |
| Decreto 222/014 (reglamenta la Ley 19.121) | completo (arts. 1-83) | 83 |
| TOCAF | arts. 26-79 | 54 |
| TOFUP 2024 (ONSC) | arts. 1018-1236 | 219 |

En total son **636 artículos, 83 temas, 1.698 flashcards y 1.617 preguntas**.

## Qué trae

- **Por tema y por artículo:** resumen, explicación fácil (ELI5), puntos clave, la trampa típica de examen y el texto literal.
- **Flashcards con repetición espaciada:** te vuelve a mostrar lo que te cuesta y espacia lo que ya sabés.
- **Preguntas:** opción múltiple, verdadero/falso y casos prácticos, con explicación y el artículo a mano. Se pueden filtrar por norma, tema, tipo y dificultad.
- **Simulacro cronometrado:** preguntas ponderadas por norma, con nota sobre 50 y resultado por norma.
- **Consulta:** tabla de plazos, cifras y mayorías; glosario; reglas mnemotécnicas y buscador.
- **Progreso:** se guarda en el navegador y se puede exportar e importar.
- Funciona en el celular, tiene modo oscuro y, después de la primera visita, anda sin conexión.

## Uso

Es un sitio estático, sin build ni dependencias. Para publicarlo con GitHub Pages: *Settings → Pages → Deploy from branch → main / (root)*.

Para usarlo localmente: `python3 -m http.server` en esta carpeta y abrir `http://localhost:8000`.

## Fuentes

- Los textos literales vienen de [IMPO](https://www.impo.com.uy) y del [TOFUP 2024 de la ONSC](https://www.gub.uy/oficina-nacional-servicio-civil/comunicacion/noticias/texto-ordenado-normas-sobre-funcionarios-publicos).
- **Aviso sobre el TOCAF:** la base TOCAF de IMPO no incorpora todas las reformas legales posteriores a 2012. En los artículos donde la ley de origen tiene una redacción más nueva (por ejemplo los arts. 33, 38 y 52), se usó el texto legal vigente y se avisa en el resumen de cada artículo.
- Los resúmenes, flashcards y preguntas son material de estudio. Si algo no coincide, vale la norma oficial.
