// utils/emailTemplates.js

function customerTemplate(order) {
  const itemsHtml = order.items
    ? order.items.map(item => `
        <tr>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.tea_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.package_name}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${parseFloat(item.price_per_unit).toFixed(2)}</td>
          <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${parseFloat(item.subtotal).toFixed(2)}</td>
        </tr>
      `).join('')
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Thank You for Your Order!</h1>
        </div>
        <div class="content">
          <p>Dear ${order.customerName},</p>
          <p>We've received your order and it's being processed. Here are your order details:</p>
          
          <div class="order-box">
            <h3 style="margin-top: 0; color: #667eea;">Order Information</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Order Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
            <p><strong>Total Amount:</strong> <span style="font-size: 24px; color: #667eea;">₹${order.totalAmount}</span></p>
          </div>

          ${order.items ? `
          <div class="order-box">
            <h3 style="margin-top: 0; color: #667eea;">Order Items</h3>
            <table class="table">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 10px; text-align: left;">Product</th>
                  <th style="padding: 10px; text-align: left;">Package</th>
                  <th style="padding: 10px; text-align: center;">Qty</th>
                  <th style="padding: 10px; text-align: right;">Price</th>
                  <th style="padding: 10px; text-align: right;">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${order.shippingAddress ? `
          <div class="order-box">
            <h3 style="margin-top: 0; color: #667eea;">Shipping Address</h3>
            <p style="margin: 5px 0;">${order.shippingAddress.address}</p>
            <p style="margin: 5px 0;">${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}</p>
          </div>
          ` : ''}

          <p>We'll notify you once your order is shipped.</p>
          
          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" class="button">Track Your Order</a>
          </center>
        </div>
        <div class="footer">
          <p>© 2024 Zenveda. All rights reserved.</p>
          <p>Need help? Contact us at ${process.env.SUPPORT_EMAIL || 'support@zenveda.com'}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function adminTemplate(order) {
  const itemsHtml = order.items
    ? order.items.map(item => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.tea_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.package_name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${parseFloat(item.subtotal).toFixed(2)}</td>
        </tr>
      `).join('')
    : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
        .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">🔔 New Order Received</h2>
        </div>
        <div class="content">
          <div class="alert-box">
            <strong>Action Required:</strong> A new order has been placed and requires processing.
          </div>
          
          <h3>Order Details</h3>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Customer:</strong> ${order.customerName}</p>
          <p><strong>Email:</strong> ${order.customerEmail || 'N/A'}</p>
          <p><strong>Total Amount:</strong> <span style="font-size: 20px; color: #27ae60;">₹${order.totalAmount}</span></p>
          
          ${order.items ? `
          <h3>Items</h3>
          <table class="table">
            <thead>
              <tr style="background: #f5f5f5;">
                <th style="padding: 8px; text-align: left;">Product</th>
                <th style="padding: 8px; text-align: left;">Package</th>
                <th style="padding: 8px; text-align: center;">Qty</th>
                <th style="padding: 8px; text-align: right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          ` : ''}

          ${order.shippingAddress ? `
          <h3>Shipping Address</h3>
          <p style="background: white; padding: 15px; border-radius: 5px; margin: 10px 0;">
            ${order.shippingAddress.address}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}
          </p>
          ` : ''}

          <p style="margin-top: 20px;">
            <a href="${process.env.ADMIN_URL || 'http://localhost:3000/admin'}/orders" 
               style="display: inline-block; padding: 10px 20px; background: #3498db; color: white; text-decoration: none; border-radius: 5px;">
              View in Admin Panel
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function orderShippedTemplate(order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .status-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">📦 Your Order Has Been Shipped!</h1>
        </div>
        <div class="content">
          <p>Dear ${order.customerName},</p>
          
          <div class="status-box">
            <h3 style="margin-top: 0; color: #28a745;">✓ Great News!</h3>
            <p style="margin-bottom: 0;">Your order is on its way and will be delivered soon.</p>
          </div>

          <div class="order-box">
            <h3 style="margin-top: 0; color: #3498db;">Shipment Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
          </div>

          ${order.items ? `
          <div class="order-box">
            <h3 style="margin-top: 0; color: #3498db;">Items in This Shipment</h3>
            <table class="table">
              <thead>
                <tr style="background: #f5f5f5;">
                  <th style="padding: 10px; text-align: left;">Product</th>
                  <th style="padding: 10px; text-align: left;">Package</th>
                  <th style="padding: 10px; text-align: center;">Quantity</th>
                </tr>
              </thead>
              <tbody>
                ${order.items.map(item => `
                  <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.tea_name}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.package_name}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}

          ${order.shippingAddress ? `
          <div class="order-box">
            <h3 style="margin-top: 0; color: #3498db;">Delivery Address</h3>
            <p style="margin: 5px 0;">${order.shippingAddress.address}</p>
            <p style="margin: 5px 0;">${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.pincode}</p>
          </div>
          ` : ''}

          <p>You'll receive another email once your order is delivered.</p>
          
          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" class="button">Track Your Order</a>
          </center>
        </div>
      </div>
    </body>
    </html>
  `;
}

function orderDeliveredTemplate(order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .success-box { background: #d4edda; border-left: 4px solid #28a745; padding: 20px; margin: 20px 0; border-radius: 5px; text-align: center; }
        .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 30px; background: #27ae60; color: white; text-decoration: none; border-radius: 5px; margin: 10px 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🎉 Order Delivered Successfully!</h1>
        </div>
        <div class="content">
          <p>Dear ${order.customerName},</p>
          
          <div class="success-box">
            <h2 style="margin: 0; color: #28a745;">✓ Delivered!</h2>
            <p style="font-size: 18px; margin: 10px 0;">Your order has been successfully delivered.</p>
          </div>

          <div class="order-box">
            <h3 style="margin-top: 0; color: #27ae60;">Order Summary</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
          </div>

          ${order.items ? `
          <div class="order-box">
            <h3 style="margin-top: 0; color: #27ae60;">Delivered Items</h3>
            <ul style="list-style: none; padding: 0;">
              ${order.items.map(item => `
                <li style="padding: 10px; border-bottom: 1px solid #eee;">
                  <strong>${item.tea_name}</strong> - ${item.package_name} (Qty: ${item.quantity})
                </li>
              `).join('')}
            </ul>
          </div>
          ` : ''}

          <p style="text-align: center; margin: 30px 0;">
            <strong>We hope you enjoy your purchase!</strong><br>
            Your feedback means a lot to us.
          </p>
          
          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/orders" class="button">View Order</a>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/review" class="button" style="background: #f39c12;">Leave a Review</a>
          </center>

          <p style="text-align: center; color: #666; font-size: 14px; margin-top: 30px;">
            Thank you for choosing Zenveda!
          </p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function orderCancelledTemplate(order) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .alert-box { background: #f8d7da; border-left: 4px solid #dc3545; padding: 20px; margin: 20px 0; border-radius: 5px; }
        .order-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .button { display: inline-block; padding: 12px 30px; background: #3498db; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">Order Cancelled</h1>
        </div>
        <div class="content">
          <p>Dear ${order.customerName},</p>
          
          <div class="alert-box">
            <h3 style="margin-top: 0; color: #dc3545;">Order Cancelled</h3>
            <p style="margin-bottom: 0;">Your order has been cancelled as requested.</p>
          </div>

          <div class="order-box">
            <h3 style="margin-top: 0; color: #e74c3c;">Cancelled Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Total Amount:</strong> ₹${order.totalAmount}</p>
          </div>

          ${order.items ? `
          <div class="order-box">
            <h3 style="margin-top: 0; color: #e74c3c;">Cancelled Items</h3>
            <ul style="list-style: none; padding: 0;">
              ${order.items.map(item => `
                <li style="padding: 10px; border-bottom: 1px solid #eee;">
                  ${item.tea_name} - ${item.package_name} (Qty: ${item.quantity})
                </li>
              `).join('')}
            </ul>
          </div>
          ` : ''}

          <p><strong>Refund Information:</strong></p>
          <p>If you've already made a payment, the refund will be processed within 5-7 business days. The amount will be credited to your original payment method.</p>

          <p>We're sorry to see this order cancelled. If you have any questions or concerns, please don't hesitate to contact our support team.</p>
          
          <center>
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop" class="button">Continue Shopping</a>
          </center>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  customerTemplate,
  adminTemplate,
  orderShippedTemplate,
  orderDeliveredTemplate,
  orderCancelledTemplate,
};