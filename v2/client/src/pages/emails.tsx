import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmailListItem } from "@/components/email-list-item";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Filter, RefreshCw, Archive, Trash2, FolderInput, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmailWithClassification, Category } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { Label } from "@/components/ui/label";

export default function Emails() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedEmail, setSelectedEmail] = useState<EmailWithClassification | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [filterSender, setFilterSender] = useState("");
  const [filterDateRange, setFilterDateRange] = useState<string>("all");

  const { data: emails, isLoading: emailsLoading, refetch } = useQuery<EmailWithClassification[]>({
    queryKey: ["/api/emails", { category: selectedCategory, search: searchQuery }],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/emails/sync", {}),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Đã làm mới danh sách email" });
    },
    onError: (error: any) => {
      toast({ title: "Lỗi làm mới", description: error.message, variant: "destructive" });
    },
  });

  const classifyMutation = useMutation({
    mutationFn: ({ emailId, categoryId, isManual }: { emailId: string; categoryId: string; isManual: boolean }) =>
      apiRequest("POST", `/api/emails/${emailId}/classify`, { categoryId, isManual }),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/categories/stats"] });
      toast({ title: "Đã cập nhật phân loại" });
      setSelectedEmail(null);
    },
    onError: (error: any) => {
      toast({ title: "Lỗi phân loại", description: error.message, variant: "destructive" });
    },
  });

  const getDateFilter = (dateRange: string, email: EmailWithClassification) => {
    if (dateRange === "all") return true;
    const emailDate = new Date(email.receivedAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - emailDate.getTime()) / (1000 * 60 * 60 * 24));

    switch (dateRange) {
      case "today":
        return daysDiff === 0;
      case "week":
        return daysDiff <= 7;
      case "month":
        return daysDiff <= 30;
      default:
        return true;
    }
  };

  const filteredEmails = emails?.filter((email) => {
    const matchesSearch = !searchQuery ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.fromEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (email.body && email.body.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === "all" ||
      email.classification?.categoryId === selectedCategory;

    const matchesArchived = showArchived ? email.isArchived : !email.isArchived;

    const matchesSender = !filterSender ||
      email.fromEmail.toLowerCase().includes(filterSender.toLowerCase());

    const matchesDate = getDateFilter(filterDateRange, email);

    return matchesSearch && matchesCategory && matchesArchived && matchesSender && matchesDate;
  }) || [];

  const handleSelectAll = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map(e => e.id)));
    }
  };

  const handleSelectEmail = (emailId: string) => {
    const newSelected = new Set(selectedEmails);
    if (newSelected.has(emailId)) {
      newSelected.delete(emailId);
    } else {
      newSelected.add(emailId);
    }
    setSelectedEmails(newSelected);
  };

  const handleBulkAction = (action: string) => {
    if (selectedEmails.size === 0) {
      toast({ title: "Chưa chọn email", description: "Vui lòng chọn ít nhất một email", variant: "destructive" });
      return;
    }

    toast({ title: `Đang xử lý ${selectedEmails.size} email`, description: `Hành động: ${action}` });
    setSelectedEmails(new Set());
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategory("all");
    setFilterSender("");
    setFilterDateRange("all");
    setShowArchived(false);
  };

  const hasActiveFilters = searchQuery || selectedCategory !== "all" || filterSender || filterDateRange !== "all" || showArchived;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">Emails</h1>
            <p className="text-muted-foreground mt-1">
              Quản lý và phân loại email ({filteredEmails.length} emails)
            </p>
          </div>
          <div className="flex gap-2">
            {selectedEmails.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedEmails.size} đã chọn
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("archive")}
                >
                  <Archive className="h-4 w-4 mr-1" />
                  Lưu trữ
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("categorize")}
                >
                  <FolderInput className="h-4 w-4 mr-1" />
                  Phân loại
                </Button>
              </div>
            )}
            <Button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              data-testid="button-refresh-emails"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Làm mới
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tìm kiếm email (chủ đề, người gửi, nội dung)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-email"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Danh mục" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả danh mục</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Người gửi</Label>
              <Input
                placeholder="Lọc theo người gửi"
                value={filterSender}
                onChange={(e) => setFilterSender(e.target.value)}
                className="w-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Thời gian</Label>
              <Select value={filterDateRange} onValueChange={setFilterDateRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="today">Hôm nay</SelectItem>
                  <SelectItem value="week">7 ngày</SelectItem>
                  <SelectItem value="month">30 ngày</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-archived"
                checked={showArchived}
                onCheckedChange={(checked) => setShowArchived(checked as boolean)}
              />
              <Label htmlFor="show-archived" className="text-sm cursor-pointer">
                Hiển thị đã lưu trữ
              </Label>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Xóa bộ lọc
              </Button>
            )}
          </div>
        </div>

        {emailsLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : filteredEmails.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                checked={selectedEmails.size === filteredEmails.length && filteredEmails.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-muted-foreground">Chọn tất cả</span>
            </div>
            {filteredEmails.map((email) => (
              <div key={email.id} className="flex items-center gap-2">
                <Checkbox
                  checked={selectedEmails.has(email.id)}
                  onCheckedChange={() => handleSelectEmail(email.id)}
                />
                <div className="flex-1">
                  <EmailListItem
                    email={email}
                    onClick={() => setSelectedEmail(email)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-lg font-medium text-muted-foreground">Không tìm thấy email</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters ? "Thử thay đổi bộ lọc" : "Nhấn 'Làm mới' để đồng bộ email"}
            </p>
          </div>
        )}
      </div>

      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmail?.subject}</DialogTitle>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Từ: </span>
                  <span>{selectedEmail.fromEmail}</span>
                </div>
                <div>
                  <span className="font-medium">Đến: </span>
                  <span>{selectedEmail.toEmail}</span>
                </div>
                <div>
                  <span className="font-medium">Thời gian: </span>
                  <span>{formatDistanceToNow(new Date(selectedEmail.receivedAt), { addSuffix: true, locale: vi })}</span>
                </div>
                {selectedEmail.classification && (
                  <div>
                    <span className="font-medium">Danh mục: </span>
                    <Badge style={{ backgroundColor: selectedEmail.classification.category.color }}>
                      {selectedEmail.classification.category.name}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {selectedEmail.body || selectedEmail.snippet}
                </div>
              </div>

              <div className="border-t pt-4">
                <Label className="mb-2 block">Phân loại lại email</Label>
                <Select
                  onValueChange={(value) => {
                    classifyMutation.mutate({
                      emailId: selectedEmail.id,
                      categoryId: value,
                      isManual: true
                    });
                  }}
                  value={selectedEmail.classification?.categoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn danh mục" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
