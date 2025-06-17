import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export default function ShadcnTest() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-3xl font-bold text-primary">shadcn/ui Test Components</h1>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>WildCat Radio</CardTitle>
          <CardDescription>
            Testing shadcn/ui components in your frontend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Input placeholder="Enter your message..." />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Button variant="default">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <Badge>Live</Badge>
            <Badge variant="secondary">DJ</Badge>
            <Badge variant="outline">Listener</Badge>
            <Badge variant="destructive">Offline</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 