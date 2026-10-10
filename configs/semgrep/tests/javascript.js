// Fixtures are scanned as text; they are never executed.
// ruleid: no-eval
eval(input);
// ok: no-eval
JSON.parse(input);

// ruleid: no-dynamic-function
new Function(input);
// ruleid: no-dynamic-function
Function(input);
// ok: no-dynamic-function
const greet = (name) => `Hello, ${name}`;

// ruleid: no-shell-exec
exec(command);
// ruleid: no-shell-exec
childProcess.execSync(command);
// ok: no-shell-exec
execFile("node", ["--version"]);

// ruleid: no-shell-enabled-spawn
spawn("node", args, { shell: true });
// ruleid: no-shell-enabled-spawn
childProcess.spawnSync("node", args, { shell: true, stdio: "inherit" });
// ok: no-shell-enabled-spawn
spawn("node", args, { stdio: "inherit" });
