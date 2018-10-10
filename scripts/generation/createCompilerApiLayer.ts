﻿/**
 * Code generation: Create Compiler API Layer
 * ------------------------------------------
 * This creates a file that contains the typings from the TypeScript compiler API.
 * ------------------------------------------
 */
import * as path from "path";
import { UnionTypeNode } from "ts-simple-ast";
import { rootFolder } from "../config";
import { InspectorFactory } from "../inspectors";
import { ArrayUtils } from "../../src/utils";
import { removeImportTypes } from "../common";
import { cloneNamespaces } from "../common/cloning";

const enumsToSeparate = ["SyntaxKind", "ScriptTarget", "ScriptKind", "LanguageVariant", "EmitHint", "JsxEmit", "ModuleKind", "ModuleResolutionKind",
    "NewLineKind", "TypeFlags", "ObjectFlags", "SymbolFlags", "TypeFormatFlags", "DiagnosticCategory", "IndentStyle"];
const interfacesToSeparate = ["CompilerOptions", "MapLike", "EditorSettings"];
const typeAliasesToSeparate: string[] = [];

export function createCompilerApiLayer(factory: InspectorFactory) {
    const tsInspector = factory.getTsInspector();
    const project = factory.getProject();
    const declarationFile = tsInspector.getDeclarationFile();

    const tsNamespaces = declarationFile.getNamespaces().filter(n => n.getName() === "ts");
    const allEnums = ArrayUtils.flatten(tsNamespaces.map(n => n.getEnums()));
    const allInterfaces = ArrayUtils.flatten(tsNamespaces.map(n => n.getInterfaces()));
    const allTypeAliases = ArrayUtils.flatten(tsNamespaces.map(n => n.getTypeAliases()));

    createTsSourceFile();

    function createTsSourceFile() {
        const sourceFile = getOrCreateSourceFile("typescript.ts");

        sourceFile.addImportDeclarations([{
            namespaceImport: "tsCompiler",
            moduleSpecifier: "typescript"
        }, {
            namedImports: ["ObjectUtils"],
            moduleSpecifier: sourceFile.getRelativePathAsModuleSpecifierTo(project.getSourceFileOrThrow("src/utils/ObjectUtils.ts"))
        }]);

        addSeparatedDeclarations();

        const tsNamespace = sourceFile.addNamespace({
            name: "ts",
            isExported: true
        });

        addEnumExports();

        cloneNamespaces(tsNamespace, ArrayUtils.flatten(tsNamespaces.map(n => n.getNamespaces())));
        tsNamespace.addInterfaces(allInterfaces.filter(i => interfacesToSeparate.indexOf(i.getName()) === -1).map(i => ({
            ...i.getStructure(),
            isExported: true
        })));
        tsNamespace.addEnums(allEnums.filter(e => enumsToSeparate.indexOf(e.getName()) === -1).map(e => ({
            ...e.getStructure(),
            isExported: true
        })));
        tsNamespace.addTypeAliases(allTypeAliases.filter(t => typeAliasesToSeparate.indexOf(t.getName()) === -1).map(t => ({
            ...t.getStructure(),
            isExported: true
        })));
        tsNamespace.addClasses(ArrayUtils.flatten(tsNamespaces.map(n => n.getClasses())).map(c => ({
            ...c.getStructure(),
            hasDeclareKeyword: true,
            isExported: true
        })));
        tsNamespace.addFunctions(ArrayUtils.flatten(tsNamespaces.map(n => n.getFunctions())).map(f => ({
            ...f.getStructure(),
            hasDeclareKeyword: true,
            isExported: true
        })));
        tsNamespace.addVariableStatements(ArrayUtils.flatten(tsNamespaces.map(n => n.getVariableStatements())).map(v => ({
            ...v.getStructure(),
            hasDeclareKeyword: true,
            isExported: true
        })));

        tsNamespace.getInterfaceOrThrow("Node").addProperty({
            docs: [{
                description: "This brand prevents using nodes not created within this library or not created within the ts namespace object of this library.\n" +
                    "It's recommended that you only use this library and use its ts named export for all your TypeScript compiler needs.\n" +
                    "If you want to ignore this and are using the same TypeScript compiler version as ts.versionMajorMinor then assert it to ts.Node.\n" +
                    "If you don't use this library with this same major & minor version of TypeScript then be warned, you may encounter unexpected behaviour."
            }],
            name: "_tsSimpleAstBrand",
            type: "undefined"
        });

        sourceFile.insertStatements(0, writer => {
            writer.writeLine("/* tslint:disable */")
                .writeLine("/*")
                .writeLine(" * TypeScript Compiler Declaration File")
                .writeLine(" * ====================================")
                .writeLine(" * DO NOT EDIT - This file is automatically generated by createCompilerApiLayer.ts")
                .writeLine(" *")
                .writeLine(" * This file contains the TypeScript compiler declarations slightly modified.")
                .writeLine(" * Note: The TypeScript compiler is licensed under the Apache 2.0 license.")
                .writeLine(" */");
        });

        tsNamespace.addStatements(writer => {
            writer.newLine();
            writer.writeLine("// overwrite this namespace with the TypeScript compiler");
            writer.write("ObjectUtils.assign((ts as any), tsCompiler);");
        });

        sourceFile.replaceWithText(sourceFile.getFullText().replace(/ *\r?\n/g, "\r\n").replace(/(\r\n)+$/, "\r\n"));
        removeImportTypes(sourceFile);

        function addSeparatedDeclarations() {
            sourceFile.addEnums(allEnums.filter(e => enumsToSeparate.indexOf(e.getName()) >= 0).map(enumDec => ({
                ...enumDec.getStructure(),
                hasDeclareKeyword: true,
                isExported: false
            })));

            sourceFile.addInterfaces(allInterfaces.filter(i => interfacesToSeparate.indexOf(i.getName()) >= 0).map(i => ({
                ...i.getStructure(),
                isExported: true
            })));

            sourceFile.addTypeAliases(allTypeAliases.filter(t => typeAliasesToSeparate.indexOf(t.getName()) >= 0).map(t => ({
                ...t.getStructure(),
                isExported: true
            })));

            // todo: need a better way of doing this in the future...
            const returnTypeNode = sourceFile.getInterfaceOrThrow("CompilerOptions").getIndexSignatures()[0].getReturnTypeNode() as UnionTypeNode;
            returnTypeNode.getTypeNodes().map(n => {
                const nodeText = n.getText();
                if (nodeText === "CompilerOptionsValue" || nodeText === "JsonSourceFile" || nodeText === "TsConfigSourceFile")
                    n.replaceWithText(`ts.${nodeText}`);
            });
        }

        function addEnumExports() {
            const filteredEnums = allEnums.filter(e => enumsToSeparate.indexOf(e.getName()) >= 0);
            sourceFile.addStatements(writer => {
                writer.newLine();
                writer.writeLine("// this is a trick to get the enums defined in the local scope by their name, but have the compiler");
                writer.writeLine("// understand this as exporting the ambient declarations above (so it works at compile time and run time)");
                writer.writeLine("// @ts-ignore: Implicit use of this.");
                writer.writeLine("const tempThis = this as any;");
                for (let i = 0; i < filteredEnums.length; i++) {
                    const enumName = filteredEnums[i].getName();
                    writer.writeLine(`tempThis["${enumName}"] = tsCompiler.${enumName};`);
                }
                writer.blankLine();

                writer.write(`export `).inlineBlock(() => {
                    for (let i = 0; i < filteredEnums.length; i++) {
                        const enumName = filteredEnums[i].getName();
                        if (i > 0)
                            writer.write(",").newLine();
                        writer.write(`${enumName}`);
                    }
                }).write(";");
            });
        }
    }

    function getOrCreateSourceFile(fileName: string) {
        const filePath = path.join(rootFolder, "src/typescript", fileName);
        const existingSourceFile = project.getSourceFile(filePath);
        if (existingSourceFile != null)
            existingSourceFile.removeText();
        return existingSourceFile || project.createSourceFile(filePath);
    }
}