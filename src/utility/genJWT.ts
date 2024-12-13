import jwt, { SignOptions, VerifyErrors, JwtPayload } from "jsonwebtoken";

export const generateJWT = (
  payload: JwtPayload,
  options?: SignOptions
): string => {
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, options);
    return token;
  } catch (error) {
    throw new Error(`Error generating JWT: ${(error as Error).message}`);
  }
};

export const verifyJWT = (token: string): JwtPayload => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;
    return decoded;
  } catch (error) {
    throw new Error(`Error verifying JWT: ${(error as VerifyErrors).message}`);
  }
};
