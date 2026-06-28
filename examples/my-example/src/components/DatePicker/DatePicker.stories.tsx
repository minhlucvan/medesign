import type { Meta, StoryObj } from "@storybook/react";
import { DatePicker } from "./DatePicker";

const meta: Meta<typeof DatePicker> = {
  title: "Components/DatePicker",
  component: DatePicker,
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj<typeof DatePicker>;

/** Default state — empty input with placeholder. */
export const Default: Story = {
  args: {
    placeholder: "Select a date",
    todayDate: new Date(2026, 5, 15),
  },
};

/** Pre-selected date shown in the input. */
export const WithValue: Story = {
  args: {
    value: new Date(2026, 5, 15),
    todayDate: new Date(2026, 5, 15),
  },
};
