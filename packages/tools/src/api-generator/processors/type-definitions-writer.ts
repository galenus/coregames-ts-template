import { DescribableDeprecatable } from "./core-api-declarations";
import CodeWriter from "../../common/code-writer";

const DEFAULT_TAB = "    ";
const FIRST_COMMENT_LINE = "/**";

export default class TypeDefinitionsWriter extends CodeWriter {
    constructor(
        nestedIndent: string = DEFAULT_TAB,
        firstLine?: string,
        lastLine?: string,
        contentPrefix?: string,
        wrapWithNewLines?: boolean,
        removeEmpty?: boolean,
    ) {
        super(nestedIndent, firstLine, lastLine, contentPrefix, wrapWithNewLines, removeEmpty);
    }

    protected createNew(
        nestedIndent?: string,
        firstLine?: string,
        lastLine?: string,
        contentPrefix?: string,
        wrapWithNewLines?: boolean,
        removeEmpty?: boolean,
    ): this {
        return new TypeDefinitionsWriter(
            nestedIndent,
            firstLine,
            lastLine,
            contentPrefix,
            wrapWithNewLines,
            removeEmpty,
        ) as this;
    }

    comment(addComments: (commentsBlock: CodeWriter) => void): this {
        if (this.code[0] instanceof CodeWriter && this.code[0].firstLine === FIRST_COMMENT_LINE) {
            addComments(this.code[0]);
            return this;
        }

        const commentBlock = new CodeWriter("", FIRST_COMMENT_LINE, " */", " * ");
        this.code.unshift(commentBlock);
        addComments(commentBlock);
        return this;
    }

    addDescriptionAndDeprecationFor({ Description, DeprecationMessage, IsDeprecated }: DescribableDeprecatable): this {
        if (!Description && !IsDeprecated) return this;

        this.comment(c => c
            .add(Description ?? false)
            .add(IsDeprecated ? `@deprecated ${DeprecationMessage ?? ""}` : false));

        return this;
    }

    addDefinitionLine(declarationLine: string, definition: DescribableDeprecatable): this {
        this.section()
            .add(declarationLine)
            .addDescriptionAndDeprecationFor(definition);

        return this;
    }

    addDefinitionLines<T extends DescribableDeprecatable>(
        definitions: T[],
        toDeclarationLine: (def: T) => string,
    ): this {
        definitions.forEach(definition => this.addDefinitionLine(toDeclarationLine(definition), definition));
        return this;
    }
}
