/** Deterministic eligibility only; review, deployment and release checks live in the adapter. */
export const PROTECTED_PATHS:readonly [string,RegExp][]=[
  ['auth',/auth|sessions?|credentials?|passwords?|login|logout|sign[_.-]?(?:in|up|out)/i],
  ['permissions',/permission|roles?|access[_.-]?control|acl|rbac|policy|policies/i],
  ['payments and billing',/payment|billing|checkout|price|pricing|invoice|subscription|polar|stripe|webhook/i],
  ['database schema and migrations',/schema|migration|drizzle|prisma|database|(?:^|[/_.-])(?:db|models?|entities)(?:$|[/_.-])|\.(?:sql|prisma)$/i],
  ['dependency manifests and lockfiles',/(?:^|\/)(?:package\.json|[^/]*lock[^/]*|npm-shrinkwrap\.json)$/i],
  ['flake.nix',/(?:^|\/)flake\.nix$/i],
  ['GitHub configuration',/(?:^|\/)\.github(?:\/|$)/i],
  ['environment configuration and schemas',/(?:^|[/_.-])env/i],
];
export function smallChange(input:{files:readonly string[];linesChanged:number;ticketKind:string}):boolean{
  if(!['bug','change'].includes(input.ticketKind)||!Number.isSafeInteger(input.linesChanged)||input.linesChanged<0||input.linesChanged>200||!input.files.length)return false;
  return input.files.every(path=>!!path&&!path.startsWith('/')&&!/[\\\x00-\x1f]/.test(path)&&!path.split('/').some(p=>!p||p==='.'||p==='..')&&!PROTECTED_PATHS.some(([,pattern])=>pattern.test(path)));
}
