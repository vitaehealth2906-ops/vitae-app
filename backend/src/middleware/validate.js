const { ZodError } = require('zod');

/**
 * Fabrica de middleware de validacao com Zod.
 *
 * Uso:
 *   const { z } = require('zod');
 *   const schema = z.object({ nome: z.string().min(1) });
 *   router.post('/rota', validate(schema), controller);
 *
 * @param {import('zod').ZodSchema} schema - Schema Zod para validar req.body
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      const parsed = schema.parse(req.body);
      req.body = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const mensagens = err.errors.map((e) => {
          const campo = e.path.length > 0 ? e.path.join('.') : 'valor';
          return `${campo}: ${e.message}`;
        });

        return res.status(400).json({
          erro: 'Dados invalidos. Verifique os campos e tente novamente.',
          detalhes: mensagens,
        });
      }
      next(err);
    }
  };
}

module.exports = { validate };
