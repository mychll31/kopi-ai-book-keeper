package app.pocketbook.mobile;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.pdf.PdfRenderer;
import android.net.Uri;
import android.os.Bundle;
import android.os.ParcelFileDescriptor;
import android.util.Base64;
import android.view.View;
import android.webkit.*;
import android.widget.*;
import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
  private static final String SITE = "https://book-kepping-app.vercel.app";
  private WebView web;
  private ValueCallback<Uri[]> upload;
  private byte[] exportBytes;
  private boolean exporting;
  private final java.util.concurrent.ExecutorService worker = Executors.newSingleThreadExecutor();

  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(Color.rgb(37,75,62));
    getWindow().setNavigationBarColor(Color.rgb(251,249,244));
    LinearLayout root = new LinearLayout(this); root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(251,249,244));
    root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
    web = new WebView(this); root.addView(web,new LinearLayout.LayoutParams(-1,-1));setContentView(root);
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);settings.setSupportMultipleWindows(false);
    CookieManager.getInstance().setAcceptCookie(true);CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
    web.addJavascriptInterface(new CsvBridge(),"PocketbookAndroid");
    web.setWebViewClient(new WebViewClient(){
      @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){return navigate(request.getUrl());}
      @Override public void onPageFinished(WebView view,String url){
        CookieManager.getInstance().flush();
        if(url.startsWith(SITE+"/"))web.evaluateJavascript("if(!window.__pocketbookExport){window.__pocketbookExport=true;const oldClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download&&this.href.startsWith('blob:')){fetch(this.href).then(r=>r.blob()).then(b=>{const reader=new FileReader();reader.onload=()=>PocketbookAndroid.saveCsv(String(reader.result).split(',')[1]);reader.readAsDataURL(b);});return;}return oldClick.call(this);};}",null);
      }
      @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error){if(request.isForMainFrame())new AlertDialog.Builder(MainActivity.this).setTitle("Unable to connect").setMessage("Check your internet connection and try again.").setPositiveButton("Retry",(d,w)->web.loadUrl(SITE)).setNegativeButton("Close",null).show();}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
        if(upload!=null)upload.onReceiveValue(null);upload=callback;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);intent.setType("*/*");intent.addCategory(Intent.CATEGORY_OPENABLE);intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/jpeg","image/png","image/webp","application/pdf"});
        try{startActivityForResult(intent,1);}catch(Exception e){upload.onReceiveValue(null);upload=null;return false;}return true;
      }
    });
    web.loadUrl(SITE);
  }

  private boolean navigate(Uri uri){
    if("https".equals(uri.getScheme())&&Uri.parse(SITE).getHost().equals(uri.getHost())&&uri.getPort()==-1){
      if(uri.getPath()!=null&&uri.getPath().startsWith("/api/receipts/")){viewReceipt(uri.toString());return true;}return false;
    }
    if("https".equals(uri.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception ignored){}}return true;
  }

  private void viewReceipt(String url){
    Toast.makeText(this,"Opening receipt…",Toast.LENGTH_SHORT).show();
    final String cookie=CookieManager.getInstance().getCookie(SITE);
    worker.execute(()->{HttpURLConnection connection=null;try{
      connection=(HttpURLConnection)new URL(url).openConnection();connection.setInstanceFollowRedirects(false);connection.setConnectTimeout(15000);connection.setReadTimeout(15000);if(cookie!=null)connection.setRequestProperty("Cookie",cookie);
      if(connection.getResponseCode()!=200)throw new IOException("Receipt unavailable");
      String type=connection.getContentType();ByteArrayOutputStream bytes=new ByteArrayOutputStream();try(InputStream input=connection.getInputStream()){byte[] chunk=new byte[8192];int count;while((count=input.read(chunk))!=-1){bytes.write(chunk,0,count);if(bytes.size()>3*1024*1024)throw new IOException("Receipt too large");}}
      byte[] data=bytes.toByteArray();runOnUiThread(()->showReceipt(data,type));
    }catch(Exception e){runOnUiThread(()->Toast.makeText(this,"Could not open the receipt. Please sign in and try again.",Toast.LENGTH_LONG).show());}finally{if(connection!=null)connection.disconnect();}});
  }

  private void showReceipt(byte[] data,String type){
    if(isFinishing()||isDestroyed())return;
    try{
      LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);content.setPadding(18,18,18,18);
      ImageView image=new ImageView(this);image.setAdjustViewBounds(true);image.setScaleType(ImageView.ScaleType.FIT_CENTER);
      ScrollView scroll=new ScrollView(this);scroll.addView(image);content.addView(scroll,new LinearLayout.LayoutParams(-1,Math.min(getResources().getDisplayMetrics().heightPixels*2/3,1600)));
      AlertDialog dialog=new AlertDialog.Builder(this).setTitle("Receipt").setView(content).setPositiveButton("Close",null).create();
      if(type!=null&&type.startsWith("application/pdf")){
        File file=File.createTempFile("receipt-",".pdf",getCacheDir());try(FileOutputStream out=new FileOutputStream(file)){out.write(data);}
        PdfRenderer pdf=new PdfRenderer(ParcelFileDescriptor.open(file,ParcelFileDescriptor.MODE_READ_ONLY));
        int[] current={0};TextView label=new TextView(this);label.setGravity(17);Button previous=new Button(this);previous.setText("Previous");Button next=new Button(this);next.setText("Next");
        LinearLayout buttons=new LinearLayout(this);buttons.addView(previous,new LinearLayout.LayoutParams(0,-2,1));buttons.addView(label,new LinearLayout.LayoutParams(0,-2,1));buttons.addView(next,new LinearLayout.LayoutParams(0,-2,1));content.addView(buttons);
        Runnable render=()->{try(PdfRenderer.Page page=pdf.openPage(current[0])){int width=Math.min(getResources().getDisplayMetrics().widthPixels,1600);int height=Math.min(2400,Math.max(1,width*page.getHeight()/Math.max(1,page.getWidth())));Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.WHITE);page.render(bitmap,null,null,PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY);image.setImageBitmap(bitmap);label.setText((current[0]+1)+" / "+pdf.getPageCount());previous.setEnabled(current[0]>0);next.setEnabled(current[0]<pdf.getPageCount()-1);}};
        previous.setOnClickListener(v->{current[0]--;render.run();});next.setOnClickListener(v->{current[0]++;render.run();});render.run();dialog.setOnDismissListener(d->{image.setImageDrawable(null);pdf.close();file.delete();});
      }else{BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(data,0,data.length,bounds);bounds.inSampleSize=1;while(Math.max(bounds.outWidth,bounds.outHeight)/bounds.inSampleSize>2400)bounds.inSampleSize*=2;bounds.inJustDecodeBounds=false;Bitmap bitmap=BitmapFactory.decodeByteArray(data,0,data.length,bounds);if(bitmap==null)throw new IOException("Invalid image");image.setImageBitmap(bitmap);}
      dialog.show();
    }catch(Exception e){Toast.makeText(this,"This receipt could not be displayed.",Toast.LENGTH_LONG).show();}
  }

  public final class CsvBridge {
    @JavascriptInterface public void saveCsv(String base64){
      if(base64.length()>16*1024*1024)return;
      runOnUiThread(()->{if(exporting||web.getUrl()==null||!web.getUrl().startsWith(SITE+"/"))return;try{exportBytes=Base64.decode(base64,Base64.DEFAULT);Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);intent.addCategory(Intent.CATEGORY_OPENABLE);intent.setType("text/csv");intent.putExtra(Intent.EXTRA_TITLE,"pocketbook.csv");exporting=true;startActivityForResult(intent,2);}catch(Exception e){exporting=false;exportBytes=null;}});
    }
  }
  @Override protected void onActivityResult(int request,int result,Intent intent){super.onActivityResult(request,result,intent);if(request==1&&upload!=null){upload.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result,intent));upload=null;}if(request==2){exporting=false;byte[] bytes=exportBytes;exportBytes=null;if(result==RESULT_OK&&intent!=null&&intent.getData()!=null&&bytes!=null){try(OutputStream out=getContentResolver().openOutputStream(intent.getData())){out.write(bytes);Toast.makeText(this,"CSV saved",Toast.LENGTH_SHORT).show();}catch(Exception e){Toast.makeText(this,"Unable to save CSV",Toast.LENGTH_LONG).show();}}}}
  @Override public void onBackPressed(){web.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.dispatchEvent(new Event('cancel',{cancelable:true}));return true;}return false;})()",closed->{if(!"true".equals(closed)){if(web.canGoBack())web.goBack();else super.onBackPressed();}});}
  @Override protected void onPause(){super.onPause();web.onPause();CookieManager.getInstance().flush();}
  @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();}
  @Override protected void onDestroy(){if(upload!=null)upload.onReceiveValue(null);web.destroy();worker.shutdownNow();super.onDestroy();}
}
