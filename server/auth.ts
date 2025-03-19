import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { log } from "./vite";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  if (!process.env.SESSION_SECRET) {
    throw new Error("Missing SESSION_SECRET environment variable");
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: 'email' },
      async (email, password, done) => {
        try {
          log(`Login attempt for email: ${email}`);
          const user = await storage.getUserByEmail(email);
          if (!user) {
            log(`Login failed: User not found for email: ${email}`);
            return done(null, false, { message: "Invalid email or password" });
          }
          const isValid = await comparePasswords(password, user.password);
          if (!isValid) {
            log(`Login failed: Invalid password for email: ${email}`);
            return done(null, false, { message: "Invalid email or password" });
          }
          log(`Login successful for email: ${email}`);
          return done(null, user);
        } catch (err) {
          log(`Login error: ${err instanceof Error ? err.message : String(err)}`);
          return done(err);
        }
      }
    )
  );

  // Important: Serialize only the user_id
  passport.serializeUser((user, done) => {
    log(`Serializing user: ${user.user_id}`);
    done(null, user.user_id);
  });

  // Important: Deserialize using user_id
  passport.deserializeUser(async (id: number, done) => {
    try {
      log(`Attempting to deserialize user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        log(`Deserialization failed: No user found with id: ${id}`);
        return done(null, false);
      }
      log(`Successfully deserialized user: ${id}`);
      done(null, user);
    } catch (err) {
      log(`Deserialization error for user ${id}: ${err instanceof Error ? err.message : String(err)}`);
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      log(`Registration attempt with data: ${JSON.stringify(req.body)}`);
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        log(`Registration failed: Email already exists: ${req.body.email}`);
        return res.status(400).json({ message: "Email already exists" });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });
      log(`User created successfully: ${JSON.stringify({ ...user, password: undefined })}`);

      req.login(user, (err) => {
        if (err) {
          log(`Login after registration failed: ${err.message}`);
          return next(err);
        }
        res.status(201).json(user);
      });
    } catch (err) {
      log(`Registration error: ${err instanceof Error ? err.message : String(err)}`);
      next(err);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) {
        log(`Authentication error: ${err.message}`);
        return next(err);
      }
      if (!user) {
        log(`Authentication failed: ${info?.message}`);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      req.logIn(user, (err) => {
        if (err) {
          log(`Login error: ${err.message}`);
          return next(err);
        }
        log(`User logged in successfully: ${user.user_id}`);
        res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.user_id;
    log(`Logout request for user: ${userId}`);
    req.logout((err) => {
      if (err) {
        log(`Logout error for user ${userId}: ${err.message}`);
        return next(err);
      }
      log(`User ${userId} logged out successfully`);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      log('User not authenticated');
      return res.sendStatus(401);
    }
    log(`Returning user data for: ${req.user.user_id}`);
    res.json(req.user);
  });
}