function invoiceHtml(order) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice</title>

  <!-- Tailwind CDN -->
  <script src="https://cdn.tailwindcss.com"></script>

  <style>
    body { margin: 0; padding: 0; }
    @page { size: A4; margin: 20px; }
  </style>
</head>
<body class="bg-white">

<div class="flex justify-center py-10">
  <div class="w-[800px] border border-gray-200">

    <!-- Header -->
    <div class="bg-lime-500 text-white px-6 py-4 flex justify-between items-center">
      <h1 class="text-3xl font-bold tracking-wide">INVOICE</h1>
      <div class="text-right text-sm leading-5">
        <p><span class="font-semibold">INVOICE NO:</span> ${
          order.order_number
        }</p>
        <p><span class="font-semibold">INVOICE DATE:</span> ${new Date(
          order.order_date
        ).toLocaleDateString("en-IN")}</p>
      </div>
    </div>

    <!-- Company & Client -->
    <div class="px-6 py-6 flex gap-56">

      <!-- Company -->
      <div class="flex gap-4">
        <div class="w-28 h-28 flex items-center justify-center">
          <img src="http://localhost:5000/public/img/zenveda.png" class="w-full h-full object-contain"/>
        </div>

        <div class="text-sm leading-5">
          <p class="font-semibold">Zenveda</p>
          <p>Address: 14256 Street Name</p>
          <p>City, State Zip Code</p>
          <p>Phone: +91 9220645320</p>
          <p>Email: info@zenveda.net</p>
          <p>Website: www.zenveda.net</p>
        </div>
      </div>

      <!-- Billed To -->
      <div class="text-sm leading-5">
        <p class="font-semibold mb-1">BILLED TO</p>
        <p class="font-semibold">${order.customer_name}</p>
        <p>${order.shipping_address}</p>
        <p>${order.shipping_city}, ${order.shipping_state}</p>
        <p>${order.shipping_pincode}</p>
        <p>Phone: ${order.customer_phone}</p>
        <p>Email: ${order.customer_email}</p>
      </div>
    </div>

    <!-- Table -->
    <div class="px-6">
      <table class="w-full border-collapse text-sm">
        <thead>
          <tr class="border-t border-b text-left">
            <th class="py-2 w-[80px]">ITEM NO.</th>
            <th class="py-2">PRODUCT</th>
            <th class="py-2 w-[100px]">PACKAGE</th>
            <th class="py-2 w-[100px]">QUANTITY</th>
            <th class="py-2 w-[120px]">UNIT PRICE</th>
            <th class="py-2 w-[100px]">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${order.items
            .map(
              (item, i) => `
            <tr class="border-b">
              <td class="py-3">${i + 1}</td>
              <td>${item.tea_name}</td>
              <td>${item.package_name}</td>
              <td>${item.quantity}</td>
              <td>₹${item.price_per_unit.toFixed(2)}</td>
              <td>₹${item.subtotal.toFixed(2)}</td>
            </tr>
          `
            )
            .join("")}
        </tbody>
      </table>
    </div>

    <!-- Footer -->
    <div class="px-6 py-6 flex justify-between items-end">
      <div class="text-xs text-gray-600">
        <p>Make all checks payable to Zenveda</p>
        <p class="mt-2">
          If you have any questions, please contact us.
        </p>
        <p class="mt-1">+91 9220645320 · info@zenveda.net</p>
      </div>

      <div class="w-[250px] text-sm">
        <div class="flex justify-between py-1">
          <span>SUBTOTAL</span>
          <span>₹${order.subtotal_amount.toFixed(2)}</span>
        </div>
        <div class="flex justify-between py-1">
          <span>DISCOUNT</span>
          <span>₹${order.discount_amount.toFixed(2)}</span>
        </div>
        <div class="flex justify-between py-1">
          <span>TAX</span>
          <span>₹${order.tax_amount.toFixed(2)}</span>
        </div>

        <div class="mt-3 bg-lime-500 text-white font-bold text-lg flex justify-between px-4 py-3">
          <span>${
            order.payment_status === "Paid" ? "AMOUNT PAID" : "AMOUNT DUE"
          }</span>
          <span>₹${order.total_amount.toFixed(2)}</span>
        </div>
      </div>
    </div>

  </div>
</div>

</body>
</html>
`;
}

module.exports = { invoiceHtml };
