"use client";

import { useState } from "react";
import { Page } from "@/components/brand/Page";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Drawer } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { LockedMediaCard } from "@/components/media/LockedMediaCard";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function DebugUiPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tab, setTab] = useState("one");
  const { addToast } = useToast();

  return (
    <Page className="space-y-8">
      <h1 className="font-display text-premium-h2 font-semibold text-foreground">UI kit showcase</h1>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Buttons</h2>
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Inputs and select</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Input placeholder="Email address" />
          <Select options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
        </div>
        <Textarea className="mt-3" placeholder="Textarea example" />
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Tabs, badge, avatar</h2>
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="neutral">Neutral</Badge>
          <Badge variant="primary">Primary</Badge>
          <Badge variant="accent">Accent</Badge>
          <Badge variant="success">Success</Badge>
          <Avatar><AvatarFallback>ZF</AvatarFallback></Avatar>
        </div>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="one">Tab one</TabsTrigger>
            <TabsTrigger value="two">Tab two</TabsTrigger>
          </TabsList>
          <TabsContent value="one">First tab content.</TabsContent>
          <TabsContent value="two">Second tab content.</TabsContent>
        </Tabs>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Modal, drawer, toast</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Open drawer</Button>
          <Button variant="secondary" onClick={() => addToast("Saved successfully", "success")}>Show toast</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">Open dropdown</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Profile</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Logout</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Skeleton and paywall</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-24 w-full" />
          </div>
          <LockedMediaCard title="Premium media" priceCents={500} currency="usd" />
        </div>
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modal">
        <p className="text-sm text-muted-foreground">Modal content.</p>
      </Modal>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Drawer">
        <p className="text-sm text-muted-foreground">Drawer content.</p>
      </Drawer>
    </Page>
  );
}
