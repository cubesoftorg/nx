const blacklistedArgs = ['outputPath', 'tsConfig', 'platform', 'target'];

export function parseArgs(options: Record<string, any>): string[] {
    const argsList: string[] = [];
    const args = Object.keys(options);
    const filteredArgs = args.filter((a) => !blacklistedArgs.includes(a));

    for (const filteredArg of filteredArgs) {
        const commandValue = options[filteredArg];
        if (commandValue) {
            argsList.push(`--${filteredArg}`, options[filteredArg]);
        } else {
            argsList.push(`--${filteredArg}`);
        }
    }

    return argsList;
}
