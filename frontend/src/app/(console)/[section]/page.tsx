import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Workspace } from '@/components/workspace';
async function Content({params}: {params:Promise<{section:string}>}) {
 const {section}=await params;
 if(!['dashboard','inventory','orders','analytics','settings'].includes(section)) notFound();
 return <Workspace section={section}/>;
}
export default function Page({params}: {params:Promise<{section:string}>}) {
 return <Suspense fallback={<div className="boot">Loading workspace…</div>}><Content params={params}/></Suspense>;
}
