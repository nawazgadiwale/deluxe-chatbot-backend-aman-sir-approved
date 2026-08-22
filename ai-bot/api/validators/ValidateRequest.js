import ValidationError from "../../core/errors/ValidationError.js";

const validateRequest = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      console.log("========== VALIDATION ERROR ==========");
      console.log("Request Body:");
      console.dir(req.body, { depth: null });

      console.log("Issues:");
      console.dir(result.error.issues, { depth: null });

      return next(
        new ValidationError(
          result.error.issues[0]?.message ?? "Invalid request.",
        ),
      );
    }

    req.body = result.data;

    next();
  };
};

export default validateRequest;
