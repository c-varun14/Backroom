import { test, expect } from "bun:test";
import { LocalComposeDeployer } from "./local-compose";
const d=new LocalComposeDeployer({sample:{repoPath:"/unused",containerPort:3210}});
test("rejects unknown projects and abbreviated or shell-shaped commits before any command",async()=>{
 await expect(d.deployAndGetUrl({project:"other",commitSha:"a".repeat(40),intentId:"one"})).rejects.toThrow("Unknown project");
 await expect(d.deployAndGetUrl({project:"sample",commitSha:"abcdef",intentId:"one"})).rejects.toThrow("Exact 40-character");
 await expect(d.deployAndGetUrl({project:"sample",commitSha:"$(id)",intentId:"one"})).rejects.toThrow("Exact 40-character");
});
test("rejects unsafe project identifiers and invalid ports",async()=>{
 await expect(d.current("../sample")).rejects.toThrow("Unknown project");
 const bad=new LocalComposeDeployer({sample:{repoPath:"/unused",containerPort:0}});
 await expect(bad.current("sample")).rejects.toThrow("Invalid container port");
});
