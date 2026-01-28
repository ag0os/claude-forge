#!/usr/bin/env -S bun run

import chains from "../../forge/chains.json" with { type: "json" };

const command = process.argv[2];

switch (command) {
	case "chains":
		console.log(JSON.stringify(chains, null, 2));
		break;
	case "agents":
		// To be implemented in TASK-023
		console.error("Not implemented yet. See TASK-023.");
		process.exit(1);
		break;
	case "path":
		// To be implemented in TASK-024
		console.error("Not implemented yet. See TASK-024.");
		process.exit(1);
		break;
	default:
		console.error("Usage: forge-config <chains|agents|path>");
		process.exit(1);
}
