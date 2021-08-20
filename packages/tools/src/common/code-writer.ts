export default abstract class CodeWriter {
    protected readonly code: (string | CodeWriter)[] = [];

    protected constructor(
        protected readonly nestedIndent?: string,
        public readonly firstLine?: string,
        protected readonly lastLine?: string,
        protected readonly contentPrefix: string = "",
        protected readonly wrapWithNewLines?: boolean,
        protected readonly removeEmpty?: boolean,
    ) {
        if (firstLine) this.code.push(firstLine);
    }

    protected abstract createNew(
        nestedIndent?: string,
        firstLine?: string,
        lastLine?: string,
        contentPrefix?: string,
        wrapWithNewLines?: boolean,
        removeEmpty?: boolean,
    ): this;

    protected abstract sectionName(name?: string): string | undefined;

    add(...codeLines: (string | false)[]): this {
        this.code.push(...codeLines.filter(item => !!item).map(l => `${l}`));
        return this;
    }

    section(name?: string, wrapWithNewLines = false): this {
        const section = this.createNew(
            "",
            this.sectionName(name),
            undefined,
            "",
            wrapWithNewLines,
            true,
        );
        this.code.push(section);
        return section as this;
    }

    addAsSection(...lines: string[]): this {
        return this.section().add(...lines);
    }

    scope(scopeDeclarationFirstLine: string, lastScopeLine: string | false = "}", wrapWithNewLines = false): this {
        const scopeBlock = this.createNew(
            this.nestedIndent,
            scopeDeclarationFirstLine,
            lastScopeLine || undefined,
            undefined,
            wrapWithNewLines,
        );
        this.code.push(scopeBlock);

        return scopeBlock;
    }

    getCodeLines(): string[] {
        if (this.removeEmpty && this.code.length === 1 && this.code[0] === this.firstLine) {
            return [];
        }

        const firstLineIndex = this.firstLine ? this.code.indexOf(this.firstLine) : -1;
        return [
            ...this.wrapWithNewLines ? [""] : [],
            ...this.code.flatMap((code, index) => {
                const prefix = index <= firstLineIndex
                    ? ""
                    : `${!!this.firstLine && !!this.lastLine ? this.nestedIndent : ""}${this.contentPrefix}`;

                if (code instanceof CodeWriter) {
                    return code.getCodeLines().map(line => prefix + line);
                }

                return code.split("\n")
                    .map(line => line.replace(/^\r|\r$/g, ""))
                    .map(line => prefix + line);
            }),
            ...this.lastLine ? [this.lastLine] : [],
            ...this.wrapWithNewLines ? [""] : [],
        ];
    }

    toString() {
        return this.getCodeLines().join("\n");
    }
}
