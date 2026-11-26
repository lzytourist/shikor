"use client";

import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Person } from "@/db/schema";
import { cn } from "@/lib/utils";

interface PersonComboboxProps {
  persons: Person[];
  value: string;
  onValueChange: (personId: string) => void;
  claimedPersonId?: string | null;
  placeholder?: string;
  searchPlaceholder?: string;
  modal?: boolean;
}

export function PersonCombobox({
  persons,
  value,
  onValueChange,
  claimedPersonId,
  placeholder = "Choose a family member...",
  searchPlaceholder = "Search by name, nickname, or বাংলা...",
  modal = false,
}: PersonComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedPerson = useMemo(
    () => persons.find((p) => p.id === value) ?? null,
    [persons, value],
  );

  const genderDot = (gender: Person["gender"]) =>
    gender === "M"
      ? "bg-sky-500"
      : gender === "F"
        ? "bg-rose-500"
        : "bg-muted-foreground/50";

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-10 px-3 cursor-pointer bg-background"
        >
          {selectedPerson ? (
            <span className="flex items-center gap-2 min-w-0 truncate">
              <span
                className={cn(
                  "h-2 w-2 rounded-full shrink-0",
                  genderDot(selectedPerson.gender),
                )}
              />
              <span className="truncate font-medium">
                {selectedPerson.displayName}
              </span>
              {selectedPerson.nickname && (
                <span className="text-xs text-muted-foreground truncate">
                  ({selectedPerson.nickname})
                </span>
              )}
              {claimedPersonId === selectedPerson.id && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  You
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList className="max-h-72">
            <CommandEmpty>No family member found.</CommandEmpty>
            <CommandGroup>
              {persons.map((p) => {
                const isSelected = p.id === value;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.displayName} ${p.fullName ?? ""} ${p.nickname ?? ""} ${p.nativeName ?? ""} ${p.currentCity ?? ""} ${p.id}`}
                    data-checked={isSelected}
                    onSelect={() => {
                      onValueChange(p.id);
                      setOpen(false);
                    }}
                    className="cursor-pointer py-2"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full shrink-0",
                        genderDot(p.gender),
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {p.displayName}
                        {p.nickname ? (
                          <span className="text-muted-foreground font-normal">
                            {" "}
                            ({p.nickname})
                          </span>
                        ) : null}
                      </p>
                      {(p.nativeName || p.currentCity) && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {[p.nativeName, p.currentCity]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    {claimedPersonId === p.id && (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 mr-1"
                      >
                        You
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
