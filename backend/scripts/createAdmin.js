require("dotenv").config();
const readline = require("node:readline");
const prisma = require("../services/prisma");
const { hashPassword, normalizeEmail, validatePassword } = require("../services/authService");

function ask(question) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(question, (answer) => {
    terminal.close();
    resolve(answer);
  }));
}

function askSecret(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal so the password can be entered without echo.");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const onData = (chunk) => {
      for (const character of chunk.toString("utf8")) {
        if (character === "\u0003") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          reject(new Error("Admin provisioning cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          process.stdin.off("data", onData);
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    process.stdin.on("data", onData);
  });
}

async function main() {
  const email = normalizeEmail(await ask("Admin email: "));
  const displayName = (await ask("Display name: ")).trim();
  if (!displayName || displayName.length > 100) throw new Error("Display name must be between 1 and 100 characters.");
  const password = await askSecret("Admin password (12–128 characters): ");
  validatePassword(password);
  const passwordHash = await hashPassword(password);
  await prisma.admin.create({ data: { email, displayName, passwordHash } });
  process.stdout.write(`Administrator ${email} created.\n`);
}

main()
  .catch((error) => {
    if (error?.code === "P2002") process.stderr.write("An administrator with that email already exists.\n");
    else process.stderr.write(`${error.message || "Administrator provisioning failed."}\n`);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
